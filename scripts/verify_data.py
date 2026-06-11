#!/usr/bin/env python3
"""
Verification script for R-REC verification_data CSV files.

Runs per-file and cross-file checks, printing a structured report with
[PASS], [FAIL], and [WARN] results and a summary table at the end.
"""

import argparse
import glob
import json
import math
import os
import re
import sys
from datetime import datetime, timezone
from urllib.parse import unquote

import pandas as pd
from geopy.geocoders import Nominatim

_geolocator = Nominatim(user_agent="r-rec-verify")
_bbox_cache: dict = {}


def _get_country_bbox(country):
    """Return (min_lat, max_lat, min_lon, max_lon) for a country via Nominatim, or None."""
    if country in _bbox_cache:
        return _bbox_cache[country]
    try:
        location = _geolocator.geocode(country, exactly_one=True, timeout=10)
        if location and "boundingbox" in location.raw:
            bb = location.raw["boundingbox"]
            result = (float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3]))
        else:
            result = None
    except Exception:
        result = None
    _bbox_cache[country] = result
    return result

# Approximate degree threshold for ~1 km spatial proximity check
SPATIAL_THRESHOLD_DEG = 0.009

# Relative tolerance for energy sum check (0.01%)
DEFAULT_ENERGY_TOL = 1e-4

# Relative tolerance for carbon reduction check (0.1%)
CARBON_TOL = 1e-3

EXPECTED_META_KEYS = [
    "Project Name",
    "Country",
    "US State (if applicable)",
    "US Region (if applicable)",
    "Latitude",
    "Longitude",
    "DC Capacity (kWp)",
    "Date of First Operation",
    "Begin Timestamp",
    "End Timestamp",
    "Total Energy Production (MWh)",
    "Total Carbon Reduction (tCO2e)",
    "AVERT Emissions Factor",
    "Ember Emissions Factor (gCO2e/kWh)",
    "No. of Type 1 Customers",
    "No. of Type 2 Customers",
    "Type 1-MA Consumption (MWh)",
    "Type 1-MB Consumption (MWh)",
    "Type 2 Consumption (MWh)",
    "Diesel Consumption (L)",
    "Diesel Production (MWh)",
    "Type of Installation",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_ts(val):
	"""Parse a timestamp string to a timezone-naive datetime, or None."""
	if not val or str(val).strip() == "":
		return None
	val = str(val).strip()
	formats = [
		"%Y-%m-%dT%H:%M:%S%z",
		"%Y-%m-%dT%H:%M%z",
		"%Y-%m-%dT%H:%M:%S",
		"%Y-%m-%dT%H:%M",
		"%Y-%m-%d"
	]
	# Strip compact timezone from filenames like T000000-0500 → not in metadata
	for fmt in formats:
		try:
			dt = datetime.strptime(val, fmt)
			return dt.replace(tzinfo=None)  # strip tz for comparison
		except ValueError:
			continue
	# pandas fallback
	try:
		dt = pd.to_datetime(val, utc=False)
		if dt.tzinfo is not None:
			dt = dt.tz_localize(None)
		return dt.to_pydatetime()
	except Exception:
		return None


def _rel_diff(a, b):
	"""Relative difference |a-b|/max(|a|,|b|,1e-12)."""
	denom = max(abs(a), abs(b), 1e-12)
	return abs(a - b) / denom


def _ranges_overlap(start1, end1, start2, end2):
	"""Return True if two date ranges overlap (inclusive)."""
	return start1 <= end2 and start2 <= end1


def _deg_distance(lat1, lon1, lat2, lon2):
	"""Euclidean distance in degrees (fast approximation for nearby points)."""
	return math.sqrt((lat1 - lat2) ** 2 + (lon1 - lon2) ** 2)


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_file(filepath):
	"""
	Returns (meta_dict, timeseries_df) or raises on parse failure.
	meta_dict: {field_name: value_string}
	timeseries_df: DataFrame with columns ['Datetime', 'Measured kWh']
				   plus a parsed 'dt' column (timezone-naive datetime)
	"""
	meta_df = pd.read_csv(
		filepath,
		nrows=22,
		header=None,
		encoding="utf-8-sig",
		on_bad_lines="skip",
	)
	meta = {}
	for _, row in meta_df.iterrows():
		key = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ""
		val = str(row.iloc[1]).strip() if len(row) > 1 and pd.notna(row.iloc[1]) else ""
		if key:
			meta[key] = val

	# Find the row index of the "Datetime" header dynamically, since some files
	# omit optional metadata fields (e.g. "Date of First Operation") and the
	# header row lands at a different offset than the hardcoded 23.
	with open(filepath, encoding="utf-8-sig") as _f:
		for _i, _line in enumerate(_f):
			if _line.strip().startswith("Datetime"):
				_header_row = _i
				break
		else:
			raise KeyError("Datetime")

	ts_df = pd.read_csv(
		filepath,
		skiprows=_header_row,
		encoding="utf-8-sig",
		on_bad_lines="skip",
	)
	# Drop blank separator row if present
	ts_df = ts_df.dropna(how="all")
	ts_df.columns = [c.strip() for c in ts_df.columns]
	ts_df = ts_df[ts_df["Datetime"].notna()].copy()
	ts_df["Measured kWh"] = pd.to_numeric(ts_df["Measured kWh"], errors="coerce")
	ts_df["dt"] = ts_df["Datetime"].apply(_parse_ts)

	return meta, ts_df


def _meta_get(meta, prefix):
	"""Return the first meta value whose key starts with prefix, or ''."""
	for k, v in meta.items():
		if k.startswith(prefix):
			return v
	return ""


# ---------------------------------------------------------------------------
# Per-file checks
# ---------------------------------------------------------------------------

def check_energy_sum(meta, ts, tol):
	stated = _meta_get(meta, "Total Energy Production")
	if not stated:
		return "SKIP", "Total Energy Production missing"
	try:
		stated_val = float(stated)
	except ValueError:
		return "FAIL", f"Cannot parse stated energy: {stated!r}"

	computed = ts["Measured kWh"].sum() / 1000.0
	rd = _rel_diff(stated_val, computed)
	if rd > tol:
		return "FAIL", (
			f"stated={stated_val:.6f} MWh  computed={computed:.6f} MWh  "
			f"rel_diff={rd:.4%}"
		)
	return "PASS", f"stated={stated_val:.6f} MWh  computed={computed:.6f} MWh"


def check_lat_lon_in_country(meta):
	country = _meta_get(meta, "Country")
	lat_s = _meta_get(meta, "Latitude")
	lon_s = _meta_get(meta, "Longitude")
	if not lat_s or not lon_s:
		return "SKIP", "Latitude/Longitude missing"
	try:
		lat, lon = float(lat_s), float(lon_s)
	except ValueError:
		return "FAIL", f"Cannot parse lat={lat_s!r} lon={lon_s!r}"

	bbox = _get_country_bbox(country)
	if bbox is None:
		return "WARN", f"Could not retrieve bbox for {country!r} from Nominatim"

	min_lat, max_lat, min_lon, max_lon = bbox
	if min_lat <= lat <= max_lat and min_lon <= lon <= max_lon:
		return "PASS", f"({lat}, {lon}) inside {country} bbox"
	return "FAIL", (
		f"({lat}, {lon}) outside {country} bbox "
		f"lat=[{min_lat},{max_lat}] lon=[{min_lon},{max_lon}]"
	)


def check_begin_end_timestamps(meta, ts):
	results = []
	for which, meta_key, idx in [("Begin", "Begin Timestamp", 0), ("End", "End Timestamp", -1)]:
		meta_val = _meta_get(meta, meta_key)
		meta_dt = _parse_ts(meta_val)
		if meta_dt is None:
			results.append(("FAIL", f"{which} Timestamp unparseable: {meta_val!r}"))
			continue
		if ts.empty or ts["dt"].isna().all():
			results.append(("FAIL", f"No parsed datetimes in time series"))
			continue
		valid = ts["dt"].dropna()
		data_dt = valid.iloc[idx]
		if data_dt is None:
			results.append(("FAIL", f"Cannot get {which} row datetime"))
			continue
		if isinstance(data_dt, pd.Timestamp):
			data_dt = data_dt.to_pydatetime()
		if abs((meta_dt - data_dt).total_seconds()) < 60:
			results.append(("PASS", f"{which}: metadata={meta_dt}  data={data_dt}"))
		else:
			results.append(("FAIL", f"{which}: metadata={meta_dt}  data={data_dt}"))
	return results


def check_no_gaps(ts):
	valid = ts["dt"].dropna()
	if len(valid) < 3:
		return [("SKIP", "Too few rows to check gaps")]
	deltas = valid.diff().dropna()
	median_delta = deltas.median()
	threshold = median_delta * 1.5
	gaps = deltas[deltas > threshold]
	if gaps.empty:
		return [("PASS", f"No gaps detected (interval≈{median_delta})")]
	msgs = []
	for idx in gaps.index:
		gap_start = valid.loc[idx - 1] if (idx - 1) in valid.index else "?"
		msgs.append(("WARN", f"Gap of {deltas.loc[idx]} after {gap_start} (expected≈{median_delta})"))
	return msgs


def check_non_negative(ts):
	neg = ts[ts["Measured kWh"] < 0]
	if neg.empty:
		return "PASS", "All Measured kWh ≥ 0"
	sample = neg["Datetime"].head(3).tolist()
	return "WARN", f"{len(neg)} negative values; first at: {sample}"


def check_carbon_reduction(meta):
	carbon_s = _meta_get(meta, "Total Carbon Reduction")
	energy_s = _meta_get(meta, "Total Energy Production")
	avert_s = _meta_get(meta, "AVERT Emissions Factor")
	if not carbon_s or not avert_s or not energy_s:
		return "SKIP", "Carbon/AVERT/Energy fields not all present"
	try:
		carbon = float(carbon_s)
		energy = float(energy_s)
		avert = float(avert_s)
	except ValueError:
		return "FAIL", "Cannot parse numeric fields"

	expected = energy * avert
	rd = _rel_diff(carbon, expected)
	if rd > CARBON_TOL:
		return "WARN", (
			f"Carbon: stated={carbon:.6f}  computed={expected:.6f}  rel_diff={rd:.4%}"
		)
	return "PASS", f"Carbon reduction consistent ({carbon:.4f} tCO2e)"


def check_date_range_within_year(meta):
	begin_s = _meta_get(meta, "Begin Timestamp")
	end_s = _meta_get(meta, "End Timestamp")
	begin_dt = _parse_ts(begin_s)
	end_dt = _parse_ts(end_s)
	if begin_dt is None or end_dt is None:
		return "FAIL", "Begin or End Timestamp unparseable"
	if begin_dt.year != end_dt.year:
		return "FAIL", (
			f"Begin ({begin_dt.date()}) and End ({end_dt.date()}) are in different years"
		)
	return "PASS", f"Begin and End are in the same year ({begin_dt.year})"


def check_date_of_first_operation(meta):
	first_op_s = _meta_get(meta, "Date of First Operation")
	if not first_op_s:
		return "FAIL", "Date of First Operation missing"
	first_op_dt = _parse_ts(first_op_s)
	if first_op_dt is None:
		return "FAIL", f"Cannot parse Date of First Operation: {first_op_s!r}"
	begin_s = _meta_get(meta, "Begin Timestamp")
	begin_dt = _parse_ts(begin_s)
	if begin_dt is None:
		return "FAIL", f"Begin Timestamp unparseable: {begin_s!r}"
	if first_op_dt <= begin_dt:
		return "PASS", f"first_op={first_op_dt.date()}  begin={begin_dt.date()}"
	return "FAIL", (
		f"Date of First Operation ({first_op_dt.date()}) is after "
		f"Begin Timestamp ({begin_dt.date()})"
	)


# ---------------------------------------------------------------------------
# Filename checks
# ---------------------------------------------------------------------------

_FILENAME_TS_RE = re.compile(r"(\d{4}-\d{2}-\d{2})T(\d{6})([-+]\d{4})")


def _parse_filename_timestamps(filename):
	"""Return (start_dt, end_dt) parsed from a filename like Name_YYYY-MM-DDTHHMMSS±HHMM_…csv."""
	matches = _FILENAME_TS_RE.findall(filename)
	if len(matches) < 2:
		return None, None

	def _build(date_s, time_s, tz_s):
		h, m, s = time_s[:2], time_s[2:4], time_s[4:6]
		return _parse_ts(f"{date_s}T{h}:{m}:{s}{tz_s[0]}{tz_s[1:3]}:{tz_s[3:5]}")

	return _build(*matches[0]), _build(*matches[1])


def check_filename_timestamps(filepath, meta):
	"""Check that Begin/End Timestamp metadata matches the timestamps encoded in the filename."""
	filename = os.path.basename(filepath)
	fn_start, fn_end = _parse_filename_timestamps(filename)
	results = []
	for which, fn_dt, meta_key in [
		("Begin", fn_start, "Begin Timestamp"),
		("End",   fn_end,   "End Timestamp"),
	]:
		if fn_dt is None:
			results.append(("FAIL", f"{which}: cannot parse timestamp from filename"))
			continue
		meta_val = _meta_get(meta, meta_key)
		meta_dt = _parse_ts(meta_val)
		if meta_dt is None:
			results.append(("FAIL", f"{which}: metadata {meta_key!r} unparseable: {meta_val!r}"))
			continue
		if abs((fn_dt - meta_dt).total_seconds()) < 60:
			results.append(("PASS", f"{which}: filename={fn_dt}  metadata={meta_dt}"))
		else:
			results.append(("FAIL", f"{which}: filename={fn_dt}  metadata={meta_dt}"))
	return results


# ---------------------------------------------------------------------------
# Contracts.json checks
# ---------------------------------------------------------------------------

def _load_contracts(contracts_path):
	"""
	Load contracts.json and return ({csv_basename: [tx_dicts]}, error_string).
	Only transactions with a non-null verification_data are included.
	"""
	try:
		with open(contracts_path, encoding="utf-8") as f:
			data = json.load(f)
	except Exception as e:
		return None, str(e)

	lookup = {}
	for contract in data:
		for tx in contract.get("transactions", []):
			url = tx.get("verification_data")
			if not url:
				continue
			basename = unquote(url.rstrip("/").split("/")[-1])
			lookup.setdefault(basename, []).append({
				"amount": tx.get("amount"),
				"action": tx.get("action", ""),
				"ignore": tx.get("ignore", False),
			})
	return lookup, None


def check_contracts_amount(filepath, meta, contracts_lookup):
	"""Check that the sum of non-ignored mint amounts in contracts.json matches Total Energy Production."""
	if contracts_lookup is None:
		return [("SKIP", "contracts.json not loaded")]

	basename = os.path.basename(filepath)
	entries = contracts_lookup.get(basename)
	if entries is None:
		return [("WARN", "File not referenced in contracts.json")]

	mints = [e for e in entries if not e["ignore"] and e["action"] == "mint"]
	if not mints:
		return [("WARN", "No non-ignored mint transactions reference this file in contracts.json")]
	if len(mints) > 1:
		return [("FAIL", "Multiple entries for this file in contracts.json")]

	minted_amount = sum(e["amount"] for e in mints if e["amount"] is not None)

	energy_s = _meta_get(meta, "Total Energy Production")
	if not energy_s:
		return [("SKIP", "Total Energy Production missing from metadata")]
	try:
		energy_mwh = float(energy_s)
	except ValueError:
		return [("FAIL", f"Cannot parse Total Energy Production: {energy_s!r}")]

	diff = minted_amount - energy_mwh
	if diff >= 1.0:
		return [("FAIL", f"contracts.json amount={minted_amount} > stated energy={energy_mwh:.4f} MWh  diff={abs(diff):.4f}")]
	elif abs(diff) < 1.0:
		return [("PASS", f"contracts.json amount={minted_amount}  stated energy={energy_mwh:.4f} MWh")]
	return [("WARN", f"contracts.json amount={minted_amount} < stated energy={energy_mwh:.4f} MWh  diff={diff:.4f}")]


def check_contracts_coverage(file_records, contracts_lookup, contracts_path):
	"""Cross-file: every local CSV is in contracts.json and vice-versa; no double-mints."""
	if contracts_lookup is None:
		return [("SKIP", f"contracts.json not loaded from {contracts_path}")]

	results = []
	local_basenames = {os.path.basename(r["filename"]) for r in file_records}

	for bn in sorted(local_basenames):
		if bn not in contracts_lookup:
			results.append(("WARN", f"Local file not referenced in contracts.json: {bn}"))

	for bn, entries in sorted(contracts_lookup.items()):
		mints = [e for e in entries if not e["ignore"] and e["action"] == "mint"]
		if not mints:
			continue
		if bn not in local_basenames:
			results.append(("WARN", f"contracts.json references missing local file: {bn}"))
		if len(mints) > 1:
			total = sum(e["amount"] for e in mints if e["amount"] is not None)
			results.append(("WARN", f"Multiple mint transactions for same file ({len(mints)} mints, {total} MWh total): {bn}"))

	if not results:
		results.append(("PASS", "All local CSVs referenced in contracts.json and no double-mints detected"))
	return results


# ---------------------------------------------------------------------------
# Cross-file checks
# ---------------------------------------------------------------------------

def check_all_temporal_overlaps(file_records):
	"""
	file_records: list of dicts with keys:
		filename, project_name, lat, lon, begin_dt, end_dt
	Returns list of (level, message) tuples.
	"""
	issues = []

	# Group by (project_name, lat, lon) for same-project overlap
	from collections import defaultdict
	groups = defaultdict(list)
	for r in file_records:
		if r["begin_dt"] and r["end_dt"]:
			key = (r["project_name"], r["lat"], r["lon"])
			groups[key].append(r)

	for key, records in groups.items():
		for i in range(len(records)):
			for j in range(i + 1, len(records)):
				a, b = records[i], records[j]
				if _ranges_overlap(a["begin_dt"], a["end_dt"], b["begin_dt"], b["end_dt"]):
					issues.append(("FAIL", (
						f"Temporal overlap (same project): "
						f"{os.path.basename(a['filename'])} "
						f"[{a['begin_dt'].date()}–{a['end_dt'].date()}] "
						f"overlaps "
						f"{os.path.basename(b['filename'])} "
						f"[{b['begin_dt'].date()}–{b['end_dt'].date()}]"
					)))

	# Check cross-project spatial+temporal overlap
	valid = [r for r in file_records if r["begin_dt"] and r["end_dt"] and r["lat"] is not None]
	for i in range(len(valid)):
		for j in range(i + 1, len(valid)):
			a, b = valid[i], valid[j]
			if a["project_name"] == b["project_name"]:
				continue  # already handled above
			dist = _deg_distance(a["lat"], a["lon"], b["lat"], b["lon"])
			if dist <= SPATIAL_THRESHOLD_DEG and _ranges_overlap(
				a["begin_dt"], a["end_dt"], b["begin_dt"], b["end_dt"]
			):
				issues.append(("WARN", (
					f"Spatial+temporal overlap (different projects, dist≈{dist:.4f}°): "
					f"{os.path.basename(a['filename'])} "
					f"[{a['begin_dt'].date()}–{a['end_dt'].date()}] "
					f"and "
					f"{os.path.basename(b['filename'])} "
					f"[{b['begin_dt'].date()}–{b['end_dt'].date()}]"
				)))

	return issues


def check_project_metadata_consistency(file_records):
	"""Cross-file: for all files sharing the same Project Name, verify that
	Country, US State, US Region, Lat, Lon, DC Capacity, Date of First
	Operation, and Type of Installation are identical across files."""
	from collections import defaultdict

	FIELDS = [
		("country",          "Country"),
		("us_state",         "US State (if applicable)"),
		("us_region",        "US Region (if applicable)"),
		("lat_s",            "Latitude"),
		("lon_s",            "Longitude"),
		("dc_capacity",      "DC Capacity (kWp)"),
		("date_first_op",    "Date of First Operation"),
		("type_installation","Type of Installation"),
	]

	groups = defaultdict(list)
	for r in file_records:
		pname = r.get("project_name", "")
		if pname:
			groups[pname].append(r)

	results = []
	for pname, records in sorted(groups.items()):
		if len(records) < 2:
			continue
		for field, label in FIELDS:
			values = [r.get(field, "") for r in records]
			if len(set(values)) > 1:
				detail = ", ".join(
					f"{os.path.basename(r['filename'])}={r.get(field, '')!r}"
					for r in records
				)
				results.append(("FAIL", (
					f"Project {pname!r}: {label} mismatch: {detail}"
				)))

	if not results:
		results.append(("PASS", "All same-project files share consistent static metadata"))
	return results


def check_meta_keys_consistency(file_records):
	"""Cross-file: every file has exactly the expected metadata header fields."""
	expected = set(EXPECTED_META_KEYS)
	results = []
	for r in file_records:
		fname = os.path.basename(r["filename"])
		keys = set(r["meta_keys"])
		missing = expected - keys
		extra = keys - expected
		if missing:
			results.append(("FAIL", f"{fname}: missing metadata fields: {sorted(missing)}"))
		if extra:
			results.append(("FAIL", f"{fname}: unexpected metadata fields: {sorted(extra)}"))
	if not results:
		results.append(("PASS", "All files have the expected metadata header fields"))
	return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
	parser = argparse.ArgumentParser(
		description="Verify R-REC verification_data CSV files."
	)
	parser.add_argument(
		"--dir",
		default="verification_data",
		help="Directory containing CSV files (default: verification_data)",
	)
	parser.add_argument(
		"--tolerance",
		type=float,
		default=DEFAULT_ENERGY_TOL,
		help="Relative tolerance for energy sum check (default: 1e-4 = 0.01%%)",
	)
	_default_contracts = os.path.normpath(
		os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "js", "contracts.json")
	)
	parser.add_argument(
		"--contracts",
		default=_default_contracts,
		help="Path to contracts.json (default: web/js/contracts.json relative to this script)",
	)
	args = parser.parse_args()

	contracts_lookup, contracts_err = _load_contracts(args.contracts)
	if contracts_err:
		print(f"[WARN] Could not load contracts.json from {args.contracts!r}: {contracts_err}")

	files = sorted(glob.glob(os.path.join(args.dir, "*.csv")))
	if not files:
		print(f"No CSV files found in {args.dir!r}.")
		sys.exit(1)

	# Summary counters per file
	summary = {}  # filename -> {"PASS":n, "FAIL":n, "WARN":n, "SKIP":n}

	# Records for cross-file checks
	file_records = []

	for filepath in files:
		fname = os.path.basename(filepath)
		counters = {"PASS": 0, "FAIL": 0, "WARN": 0, "SKIP": 0}
		print(f"\n{'='*70}")
		print(f"FILE: {fname}")
		print(f"{'='*70}")

		try:
			meta, ts = parse_file(filepath)
		except Exception as e:
			print(f"  [FAIL] Parse error: {e}")
			summary[fname] = {"PASS": 0, "FAIL": 1, "WARN": 0, "SKIP": 0}
			continue

		def emit(level, msg, label):
			counters[level] += 1
			print(f"  [{level}] {label}: {msg}")

		# 1. Energy sum
		lvl, msg = check_energy_sum(meta, ts, args.tolerance)
		emit(lvl, msg, "Energy sum")

		# 2. Lat/lon in country
		lvl, msg = check_lat_lon_in_country(meta)
		emit(lvl, msg, "Lat/lon in country")

		# 3. Begin/End timestamps
		for lvl, msg in check_begin_end_timestamps(meta, ts):
			emit(lvl, msg, "Timestamp match")

		# 4. Gaps in time series
		for lvl, msg in check_no_gaps(ts):
			emit(lvl, msg, "Time series gaps")

		# 5. Non-negative energy
		lvl, msg = check_non_negative(ts)
		emit(lvl, msg, "Non-negative kWh")

		# 6. Carbon reduction
		lvl, msg = check_carbon_reduction(meta)
		emit(lvl, msg, "Carbon reduction")

		# 7. Filename timestamps match metadata
		for lvl, msg in check_filename_timestamps(filepath, meta):
			emit(lvl, msg, "Filename timestamp")

		# 8. Contracts.json amount matches stated energy
		for lvl, msg in check_contracts_amount(filepath, meta, contracts_lookup):
			emit(lvl, msg, "Contracts amount")

		# 9. Date of First Operation ≤ Begin Timestamp
		lvl, msg = check_date_of_first_operation(meta)
		emit(lvl, msg, "Date of first operation")

		# 10. Date range spans at most one year
		lvl, msg = check_date_range_within_year(meta)
		emit(lvl, msg, "Date range within year")

		summary[fname] = counters

		# Collect record for cross-file checks
		begin_dt = _parse_ts(_meta_get(meta, "Begin Timestamp"))
		end_dt = _parse_ts(_meta_get(meta, "End Timestamp"))
		lat_s = _meta_get(meta, "Latitude")
		lon_s = _meta_get(meta, "Longitude")
		try:
			lat, lon = float(lat_s), float(lon_s)
		except (ValueError, TypeError):
			lat, lon = None, None
		file_records.append({
			"filename": filepath,
			"project_name": _meta_get(meta, "Project Name"),
			"lat": lat,
			"lon": lon,
			"begin_dt": begin_dt,
			"end_dt": end_dt,
			"meta_keys": list(meta.keys()),
			"country": _meta_get(meta, "Country"),
			"us_state": _meta_get(meta, "US State"),
			"us_region": _meta_get(meta, "US Region"),
			"lat_s": _meta_get(meta, "Latitude"),
			"lon_s": _meta_get(meta, "Longitude"),
			"dc_capacity": _meta_get(meta, "DC Capacity"),
			"date_first_op": _meta_get(meta, "Date of First Operation"),
			"type_installation": _meta_get(meta, "Type of Installation"),
		})

	# Cross-file checks
	print(f"\n{'='*70}")
	print("CROSS-FILE CHECKS")
	print(f"{'='*70}")
	cross_issues = check_all_temporal_overlaps(file_records)
	cross_counters = {"PASS": 0, "FAIL": 0, "WARN": 0, "SKIP": 0}
	if not cross_issues:
		print("  [PASS] No temporal or spatial overlaps detected")
		cross_counters["PASS"] += 1
	else:
		for lvl, msg in cross_issues:
			cross_counters[lvl] += 1
			print(f"  [{lvl}] {msg}")

	for lvl, msg in check_contracts_coverage(file_records, contracts_lookup, args.contracts):
		cross_counters[lvl] += 1
		print(f"  [{lvl}] {msg}")

	for lvl, msg in check_meta_keys_consistency(file_records):
		cross_counters[lvl] += 1
		print(f"  [{lvl}] {msg}")

	for lvl, msg in check_project_metadata_consistency(file_records):
		cross_counters[lvl] += 1
		print(f"  [{lvl}] {msg}")

	# Summary table
	print(f"\n{'='*70}")
	print("SUMMARY")
	print(f"{'='*70}")
	col_w = max(len(f) for f in summary) + 2
	print(f"  {'File':<{col_w}} {'PASS':>5} {'FAIL':>5} {'WARN':>5} {'SKIP':>5}")
	print(f"  {'-'*col_w} {'----':>5} {'----':>5} {'----':>5} {'----':>5}")
	total = {"PASS": 0, "FAIL": 0, "WARN": 0, "SKIP": 0}
	for fname, counts in summary.items():
		flag = " <-- ISSUES" if counts["FAIL"] > 0 else (" <-- warnings" if counts["WARN"] > 0 else "")
		print(
			f"  {fname:<{col_w}} {counts['PASS']:>5} {counts['FAIL']:>5} "
			f"{counts['WARN']:>5} {counts['SKIP']:>5}{flag}"
		)
		for k in total:
			total[k] += counts[k]
	print(f"  {'CROSS-FILE':<{col_w}} {cross_counters['PASS']:>5} {cross_counters['FAIL']:>5} "
		  f"{cross_counters['WARN']:>5} {cross_counters['SKIP']:>5}")
	for k in total:
		total[k] += cross_counters[k]
	print(f"  {'-'*col_w} {'----':>5} {'----':>5} {'----':>5} {'----':>5}")
	print(
		f"  {'TOTAL':<{col_w}} {total['PASS']:>5} {total['FAIL']:>5} "
		f"{total['WARN']:>5} {total['SKIP']:>5}"
	)

	if total["FAIL"] > 0:
		sys.exit(1)


if __name__ == "__main__":
	main()
