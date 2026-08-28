"use strict";

/*
 * Browser port of scripts/verifyData.py --file <upload>.
 * Runs every per-file check locally, then fetches the sibling CSVs listed in
 * verification_data/files.json and web/js/contracts.json (same-origin, no
 * backend) to run the cross-file checks against them.
 */

const FILES_JSON_URL = "verification_data/files.json";
const CONTRACTS_URL = "web/js/contracts.json";
const DATA_DIR = "verification_data/";

const SPATIAL_THRESHOLD_DEG = 0.0008;
const DEFAULT_ENERGY_TOL = 1e-4;
const CARBON_TOL = 1e-3;

const EXPECTED_META_KEYS = [
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
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Parse an ISO-ish timestamp string to a "naive" Date (tz offset ignored,
 * exactly like Python's datetime.replace(tzinfo=None) in verifyData.py). The
 * Date is built with Date.UTC so downstream arithmetic is unaffected by the
 * viewer's local timezone. Returns null if unparseable. */
function parseTs(val) {
	if (val === null || val === undefined) return null;
	const s = String(val).trim();
	if (!s) return null;

	const m = s.match(
		/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?(?:Z|[+-]\d{2}:?\d{2})?)?$/
	);
	if (!m) return null;

	const [, y, mo, d, h, mi, se] = m;
	const date = new Date(
		Date.UTC(+y, +mo - 1, +d, h ? +h : 0, mi ? +mi : 0, se ? +se : 0)
	);
	if (Number.isNaN(date.getTime())) return null;
	return date;
}

function isIsoDate(val) {
	const s = String(val ?? "").trim();
	if (!s) return false;
	return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(s);
}

function relDiff(a, b) {
	const denom = Math.max(Math.abs(a), Math.abs(b), 1e-12);
	return Math.abs(a - b) / denom;
}

function rangesOverlap(start1, end1, start2, end2) {
	return start1 <= end2 && start2 <= end1;
}

function degDistance(lat1, lon1, lat2, lon2) {
	return Math.sqrt((lat1 - lat2) ** 2 + (lon1 - lon2) ** 2);
}

function median(nums) {
	const sorted = [...nums].sort((a, b) => a - b);
	const n = sorted.length;
	if (n === 0) return NaN;
	const mid = Math.floor(n / 2);
	return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function isNumericString(s) {
	return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s.trim());
}

function metaGet(meta, prefix) {
	for (const k of Object.keys(meta)) {
		if (k.startsWith(prefix)) return meta[k];
	}
	return "";
}

function splitCsvLine(line) {
	return line.split(",");
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Parses raw CSV text into { meta, tsRows, rawLines }.
 *   meta: { key: value } from the header block
 *   tsRows: [{ datetime, kwh, rawKwh, dt }] in file order, blank Datetime rows dropped
 *   rawLines: every raw line of the file, for the trailing-empty-row check
 */
function parseCsvText(text) {
	const normalized = text.replace(/\r\n/g, "\n");
	// A trailing "\n" splits into a phantom empty final element that Python's
	// readlines() would never produce; drop it so trailing-blank-row detection
	// only counts lines that are genuinely blank in the file.
	const trimmed = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
	const rawLines = trimmed.split("\n");

	let headerIdx = -1;
	for (let i = 0; i < rawLines.length; i++) {
		if (rawLines[i].trim().startsWith("Datetime")) {
			headerIdx = i;
			break;
		}
	}
	if (headerIdx === -1) {
		throw new Error("Could not find a 'Datetime' header row");
	}

	const meta = {};
	for (let i = 0; i < headerIdx; i++) {
		const line = rawLines[i];
		if (line.trim() === "") continue;
		const parts = splitCsvLine(line);
		const key = (parts[0] ?? "").trim();
		const val = parts.length > 1 ? (parts[1] ?? "").trim() : "";
		if (key) meta[key] = val;
	}

	const headerCols = splitCsvLine(rawLines[headerIdx]).map((c) => c.trim());
	const dtCol = headerCols.indexOf("Datetime");
	const kwhCol = headerCols.indexOf("Measured kWh");
	if (dtCol === -1 || kwhCol === -1) {
		throw new Error("Datetime/Measured kWh columns not found");
	}

	const tsRows = [];
	for (let i = headerIdx + 1; i < rawLines.length; i++) {
		const line = rawLines[i];
		if (line.trim() === "" || line.trim().replace(/,/g, "") === "") continue;
		const cols = splitCsvLine(line);
		const datetime = (cols[dtCol] ?? "").trim();
		if (!datetime) continue;
		const rawKwh = (cols[kwhCol] ?? "").trim();
		const kwh = isNumericString(rawKwh) ? parseFloat(rawKwh) : NaN;
		tsRows.push({ datetime, rawKwh, kwh, dt: parseTs(datetime) });
	}

	return { meta, tsRows, rawLines };
}

// ---------------------------------------------------------------------------
// Per-file checks (mirror verifyData.py's check_* functions)
// ---------------------------------------------------------------------------

function checkEnergySum(meta, tsRows, tol) {
	const stated = metaGet(meta, "Total Energy Production");
	if (!stated) return [["FAIL", "Total Energy Production missing"]];
	const statedVal = parseFloat(stated);
	if (!isNumericString(stated)) return [["FAIL", `Cannot parse stated energy: ${JSON.stringify(stated)}`]];

	const computed = tsRows.reduce((sum, r) => sum + (Number.isNaN(r.kwh) ? 0 : r.kwh), 0) / 1000;
	const rd = relDiff(statedVal, computed);
	if (rd > tol) {
		return [["FAIL", `stated=${statedVal.toFixed(6)} MWh  computed=${computed.toFixed(6)} MWh  rel_diff=${(rd * 100).toFixed(4)}%`]];
	}
	return [["PASS", `stated=${statedVal.toFixed(6)} MWh  computed=${computed.toFixed(6)} MWh`]];
}

async function checkLatLonInCountry(meta, bboxCache) {
	const country = metaGet(meta, "Country");
	const latS = metaGet(meta, "Latitude");
	const lonS = metaGet(meta, "Longitude");
	if (!latS || !lonS) return [["FAIL", "Latitude/Longitude missing"]];
	if (!isNumericString(latS) || !isNumericString(lonS)) {
		return [["FAIL", `Cannot parse lat=${JSON.stringify(latS)} lon=${JSON.stringify(lonS)}`]];
	}
	const lat = parseFloat(latS);
	const lon = parseFloat(lonS);

	const bbox = await getCountryBbox(country, bboxCache);
	if (bbox === null) {
		return [["FAIL", `Could not retrieve bbox for ${JSON.stringify(country)} from Nominatim`]];
	}
	const [minLat, maxLat, minLon, maxLon] = bbox;
	if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
		return [["PASS", `(${lat}, ${lon}) inside ${country} bbox`]];
	}
	return [["FAIL", `(${lat}, ${lon}) outside ${country} bbox lat=[${minLat},${maxLat}] lon=[${minLon},${maxLon}]`]];
}

async function getCountryBbox(country, bboxCache) {
	if (bboxCache.has(country)) return bboxCache.get(country);
	let result = null;
	try {
		const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(country)}`;
		// Nominatim's usage policy requires an identifying Referer or User-Agent;
		// browsers can't set User-Agent from JS, so force a Referer to be sent
		// (the default policy would otherwise omit it on some https->https navigations).
		const resp = await fetch(url, { headers: { Accept: "application/json" }, referrerPolicy: "origin" });
		if (resp.ok) {
			const data = await resp.json();
			if (data && data.length && data[0].boundingbox) {
				const bb = data[0].boundingbox.map(Number); // [south, north, west, east]
				result = [bb[0], bb[1], bb[2], bb[3]];
			}
		}
	} catch {
		result = null;
	}
	bboxCache.set(country, result);
	return result;
}

function checkBeginEndTimestamps(meta, tsRows) {
	const results = [];
	const valid = tsRows.filter((r) => r.dt !== null);
	for (const [which, metaKey, idx] of [["Begin", "Begin Timestamp", 0], ["End", "End Timestamp", -1]]) {
		const metaVal = metaGet(meta, metaKey);
		const metaDt = parseTs(metaVal);
		if (metaDt === null) {
			results.push(["FAIL", `${which} Timestamp unparseable: ${JSON.stringify(metaVal)}`]);
			continue;
		}
		if (valid.length === 0) {
			results.push(["FAIL", "No parsed datetimes in time series"]);
			continue;
		}
		const dataDt = idx === 0 ? valid[0].dt : valid[valid.length - 1].dt;
		if (Math.abs(metaDt - dataDt) < 60000) {
			results.push(["PASS", `${which}: metadata=${metaDt.toISOString()}  data=${dataDt.toISOString()}`]);
		} else {
			results.push(["FAIL", `${which}: metadata=${metaDt.toISOString()}  data=${dataDt.toISOString()}`]);
		}
	}
	return results;
}

function checkNoGaps(tsRows) {
	const valid = tsRows.filter((r) => r.dt !== null);
	if (valid.length < 3) return [["SKIP", "Too few rows to check gaps"]];
	const deltas = [];
	for (let i = 1; i < valid.length; i++) deltas.push(valid[i].dt - valid[i - 1].dt);
	const med = median(deltas);
	const threshold = med * 1.5;
	const results = [];
	for (let i = 0; i < deltas.length; i++) {
		if (deltas[i] > threshold) {
			const gapStart = valid[i].datetime;
			results.push(["WARN", `Gap of ${deltas[i] / 1000}s after ${gapStart} (expected≈${med / 1000}s)`]);
		}
	}
	if (results.length === 0) return [["PASS", `No gaps detected (interval≈${med / 1000}s)`]];
	return results;
}

function checkParseableKwh(tsRows) {
	const bad = tsRows.filter(
		(r) => Number.isNaN(r.kwh) && r.rawKwh && r.rawKwh.toLowerCase() !== "nan"
	);
	if (bad.length === 0) return [["PASS", "All Measured kWh values are numeric"]];
	return bad.map((r) => ["FAIL", `Unparseable Measured kWh at ${r.datetime}: ${JSON.stringify(r.rawKwh)}`]);
}

function checkNonNegative(tsRows) {
	const neg = tsRows.filter((r) => !Number.isNaN(r.kwh) && r.kwh < 0);
	if (neg.length === 0) return [["PASS", "All Measured kWh ≥ 0"]];
	const sample = neg.slice(0, 3).map((r) => r.datetime);
	return [["WARN", `${neg.length} negative values; first at: ${JSON.stringify(sample)}`]];
}

function checkCarbonReduction(meta) {
	const carbonS = metaGet(meta, "Total Carbon Reduction");
	const energyS = metaGet(meta, "Total Energy Production");
	const avertS = metaGet(meta, "AVERT Emissions Factor");
	if (!carbonS || !avertS || !energyS) return [["SKIP", "Carbon/AVERT/Energy fields not all present"]];
	if (![carbonS, energyS, avertS].every(isNumericString)) return [["FAIL", "Cannot parse numeric fields"]];

	const carbon = parseFloat(carbonS);
	const energy = parseFloat(energyS);
	const avert = parseFloat(avertS);
	const expected = energy * avert;
	const rd = relDiff(carbon, expected);
	if (rd > CARBON_TOL) {
		return [["FAIL", `Carbon: stated=${carbon.toFixed(6)}  computed=${expected.toFixed(6)}  rel_diff=${(rd * 100).toFixed(4)}%`]];
	}
	return [["PASS", `Carbon reduction consistent (${carbon.toFixed(4)} tCO2e)`]];
}

function checkDateRangeWithinYear(meta) {
	const beginDt = parseTs(metaGet(meta, "Begin Timestamp"));
	const endDt = parseTs(metaGet(meta, "End Timestamp"));
	if (beginDt === null || endDt === null) return [["FAIL", "Begin or End Timestamp unparseable"]];
	if (beginDt.getUTCFullYear() !== endDt.getUTCFullYear()) {
		return [["FAIL", `Begin (${beginDt.toISOString().slice(0, 10)}) and End (${endDt.toISOString().slice(0, 10)}) are in different years`]];
	}
	return [["PASS", `Begin and End are in the same year (${beginDt.getUTCFullYear()})`]];
}

function checkDateOfFirstOperation(meta) {
	const firstOpS = metaGet(meta, "Date of First Operation");
	if (!firstOpS) return [["FAIL", "Date of First Operation missing"]];
	const firstOpDt = parseTs(firstOpS);
	if (firstOpDt === null) return [["FAIL", `Cannot parse Date of First Operation: ${JSON.stringify(firstOpS)}`]];
	const beginS = metaGet(meta, "Begin Timestamp");
	const beginDt = parseTs(beginS);
	if (beginDt === null) return [["FAIL", `Begin Timestamp unparseable: ${JSON.stringify(beginS)}`]];
	if (firstOpDt <= beginDt) {
		return [["PASS", `first_op=${firstOpDt.toISOString().slice(0, 10)}  begin=${beginDt.toISOString().slice(0, 10)}`]];
	}
	return [["FAIL", `Date of First Operation (${firstOpDt.toISOString().slice(0, 10)}) is after Begin Timestamp (${beginDt.toISOString().slice(0, 10)})`]];
}

function checkDateFormats(meta, tsRows) {
	const results = [];
	for (const field of ["Date of First Operation", "Begin Timestamp", "End Timestamp"]) {
		const val = metaGet(meta, field);
		if (!val) continue;
		if (!isIsoDate(val)) results.push(["FAIL", `${field} not in ISO format: ${JSON.stringify(val)}`]);
		else results.push(["PASS", `${field} is ISO formatted`]);
	}
	const nonIso = tsRows.filter((r) => !isIsoDate(r.datetime));
	if (nonIso.length > 0) {
		const samples = nonIso.slice(0, 3).map((r) => r.datetime);
		results.push(["FAIL", `${nonIso.length} timeseries rows with non-ISO Datetime; first: ${JSON.stringify(samples)}`]);
	} else {
		results.push(["PASS", "All timeseries Datetime values are ISO formatted"]);
	}
	return results;
}

const FILENAME_TS_RE = /(\d{4}-\d{2}-\d{2})T(\d{6})([-+]\d{4})/g;

function parseFilenameTimestamps(filename) {
	const matches = [...filename.matchAll(FILENAME_TS_RE)];
	if (matches.length < 2) return [null, null];
	const build = (dateS, timeS, tzS) => {
		const h = timeS.slice(0, 2), m = timeS.slice(2, 4), s = timeS.slice(4, 6);
		const tz = `${tzS[0]}${tzS.slice(1, 3)}:${tzS.slice(3, 5)}`;
		return parseTs(`${dateS}T${h}:${m}:${s}${tz}`);
	};
	return [build(...matches[0].slice(1)), build(...matches[1].slice(1))];
}

function checkFilenameTimestamps(filename, meta) {
	const [fnStart, fnEnd] = parseFilenameTimestamps(filename);
	const results = [];
	for (const [which, fnDt, metaKey] of [["Begin", fnStart, "Begin Timestamp"], ["End", fnEnd, "End Timestamp"]]) {
		if (fnDt === null) {
			results.push(["FAIL", `${which}: cannot parse timestamp from filename`]);
			continue;
		}
		const metaVal = metaGet(meta, metaKey);
		const metaDt = parseTs(metaVal);
		if (metaDt === null) {
			results.push(["FAIL", `${which}: metadata ${JSON.stringify(metaKey)} unparseable: ${JSON.stringify(metaVal)}`]);
			continue;
		}
		if (Math.abs(fnDt - metaDt) < 60000) {
			results.push(["PASS", `${which}: filename=${fnDt.toISOString()}  metadata=${metaDt.toISOString()}`]);
		} else {
			results.push(["FAIL", `${which}: filename=${fnDt.toISOString()}  metadata=${metaDt.toISOString()}`]);
		}
	}
	return results;
}

function checkNoTrailingEmptyRows(rawLines) {
	let count = 0;
	for (let i = rawLines.length - 1; i >= 0; i--) {
		const stripped = rawLines[i].trim().replace(/,/g, "");
		if (stripped === "") count++;
		else break;
	}
	if (count) return [["FAIL", `${count} trailing empty row(s) at end of file`]];
	return [["PASS", "No trailing empty rows"]];
}

// ---------------------------------------------------------------------------
// contracts.json checks
// ---------------------------------------------------------------------------

function loadContractsLookup(data) {
	const lookup = new Map();
	for (const contract of data) {
		for (const tx of contract.transactions || []) {
			const url = tx.verification_data;
			if (!url) continue;
			const basename = decodeURIComponent(url.replace(/\/+$/, "").split("/").pop());
			if (!lookup.has(basename)) lookup.set(basename, []);
			lookup.get(basename).push({
				amount: tx.amount,
				action: tx.action || "",
				ignore: !!tx.ignore,
			});
		}
	}
	return lookup;
}

function checkContractsAmount(filename, meta, contractsLookup) {
	if (contractsLookup === null) return [["FAIL", "contracts.json not loaded"]];
	const entries = contractsLookup.get(filename);
	if (entries === undefined) return [["WARN", "File not referenced in contracts.json"]];

	const mints = entries.filter((e) => !e.ignore && e.action === "mint");
	if (mints.length === 0) return [["WARN", "No non-ignored mint transactions reference this file in contracts.json"]];
	if (mints.length > 1) return [["FAIL", "Multiple entries for this file in contracts.json"]];

	const mintedAmount = mints.reduce((sum, e) => sum + (e.amount ?? 0), 0);
	const energyS = metaGet(meta, "Total Energy Production");
	if (!energyS) return [["FAIL", "Total Energy Production missing from metadata"]];
	if (!isNumericString(energyS)) return [["FAIL", `Cannot parse Total Energy Production: ${JSON.stringify(energyS)}`]];
	const energyMwh = parseFloat(energyS);

	const diff = mintedAmount - energyMwh;
	if (diff >= 1.0) {
		return [["FAIL", `contracts.json amount=${mintedAmount} > stated energy=${energyMwh.toFixed(4)} MWh  diff=${Math.abs(diff).toFixed(4)}`]];
	} else if (Math.abs(diff) < 1.0) {
		return [["PASS", `contracts.json amount=${mintedAmount}  stated energy=${energyMwh.toFixed(4)} MWh`]];
	}
	return [["WARN", `contracts.json amount=${mintedAmount} < stated energy=${energyMwh.toFixed(4)} MWh  diff=${diff.toFixed(4)}`]];
}

function checkContractsCoverage(allLocalBasenames, contractsLookup) {
	if (contractsLookup === null) return [["FAIL", "contracts.json not loaded"]];
	const results = [];
	for (const [bn, entries] of [...contractsLookup.entries()].sort()) {
		const mints = entries.filter((e) => !e.ignore && e.action === "mint");
		if (mints.length === 0) continue;
		if (!allLocalBasenames.has(bn)) {
			results.push(["FAIL", `contracts.json references missing local file: ${bn}`]);
		}
		if (mints.length > 1) {
			const total = mints.reduce((sum, e) => sum + (e.amount ?? 0), 0);
			results.push(["FAIL", `Multiple mint transactions for same file (${mints.length} mints, ${total} MWh total): ${bn}`]);
		}
	}
	if (results.length === 0) results.push(["PASS", "All local CSVs referenced in contracts.json and no double-mints detected"]);
	return results;
}

// ---------------------------------------------------------------------------
// Cross-file checks
// ---------------------------------------------------------------------------

function checkAllTemporalOverlaps(fileRecords) {
	const issues = [];
	const groups = new Map();
	for (const r of fileRecords) {
		if (r.beginDt && r.endDt) {
			const key = `${r.projectName} ${r.lat} ${r.lon}`;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(r);
		}
	}
	for (const records of groups.values()) {
		for (let i = 0; i < records.length; i++) {
			for (let j = i + 1; j < records.length; j++) {
				const a = records[i], b = records[j];
				if (rangesOverlap(a.beginDt, a.endDt, b.beginDt, b.endDt)) {
					issues.push(["FAIL", `Temporal overlap (same project): ${a.filename} [${a.beginDt.toISOString().slice(0, 10)}–${a.endDt.toISOString().slice(0, 10)}] overlaps ${b.filename} [${b.beginDt.toISOString().slice(0, 10)}–${b.endDt.toISOString().slice(0, 10)}]`]);
				}
			}
		}
	}

	const valid = fileRecords.filter((r) => r.beginDt && r.endDt && r.lat !== null);
	for (let i = 0; i < valid.length; i++) {
		for (let j = i + 1; j < valid.length; j++) {
			const a = valid[i], b = valid[j];
			if (a.projectName === b.projectName) continue;
			const dist = degDistance(a.lat, a.lon, b.lat, b.lon);
			if (dist <= SPATIAL_THRESHOLD_DEG && rangesOverlap(a.beginDt, a.endDt, b.beginDt, b.endDt)) {
				issues.push(["FAIL", `Spatial+temporal overlap (different projects, dist≈${dist.toFixed(4)}°): ${a.filename} [${a.beginDt.toISOString().slice(0, 10)}–${a.endDt.toISOString().slice(0, 10)}] and ${b.filename} [${b.beginDt.toISOString().slice(0, 10)}–${b.endDt.toISOString().slice(0, 10)}]`]);
			}
		}
	}
	return issues;
}

function checkMetaKeysConsistency(fileRecords) {
	const expected = new Set(EXPECTED_META_KEYS);
	const results = [];
	for (const r of fileRecords) {
		const keys = new Set(r.metaKeys);
		const missing = [...expected].filter((k) => !keys.has(k)).sort();
		const extra = [...keys].filter((k) => !expected.has(k)).sort();
		if (missing.length) results.push(["FAIL", `${r.filename}: missing metadata fields: ${JSON.stringify(missing)}`]);
		if (extra.length) results.push(["FAIL", `${r.filename}: unexpected metadata fields: ${JSON.stringify(extra)}`]);
	}
	if (results.length === 0) results.push(["PASS", "All files have the expected metadata header fields"]);
	return results;
}

function checkProjectMetadataConsistency(fileRecords) {
	const FIELDS = [
		["country", "Country"],
		["usState", "US State (if applicable)"],
		["usRegion", "US Region (if applicable)"],
		["latS", "Latitude"],
		["lonS", "Longitude"],
		["dcCapacity", "DC Capacity (kWp)"],
		["dateFirstOp", "Date of First Operation"],
		["typeInstallation", "Type of Installation"],
	];
	const groups = new Map();
	for (const r of fileRecords) {
		if (!r.projectName) continue;
		if (!groups.has(r.projectName)) groups.set(r.projectName, []);
		groups.get(r.projectName).push(r);
	}
	const results = [];
	for (const [pname, records] of [...groups.entries()].sort()) {
		if (records.length < 2) continue;
		for (const [field, label] of FIELDS) {
			const values = new Set(records.map((r) => r[field] ?? ""));
			if (values.size > 1) {
				const detail = records.map((r) => `${r.filename}=${JSON.stringify(r[field] ?? "")}`).join(", ");
				results.push(["FAIL", `Project ${JSON.stringify(pname)}: ${label} mismatch: ${detail}`]);
			}
		}
	}
	if (results.length === 0) results.push(["PASS", "All same-project files share consistent static metadata"]);
	return results;
}

// ---------------------------------------------------------------------------
// Building a file record (shared by the uploaded file and its siblings)
// ---------------------------------------------------------------------------

function buildFileRecord(filename, meta) {
	const latS = metaGet(meta, "Latitude");
	const lonS = metaGet(meta, "Longitude");
	const lat = isNumericString(latS) ? parseFloat(latS) : null;
	const lon = isNumericString(lonS) ? parseFloat(lonS) : null;
	return {
		filename,
		projectName: metaGet(meta, "Project Name"),
		lat,
		lon,
		beginDt: parseTs(metaGet(meta, "Begin Timestamp")),
		endDt: parseTs(metaGet(meta, "End Timestamp")),
		metaKeys: Object.keys(meta),
		country: metaGet(meta, "Country"),
		usState: metaGet(meta, "US State"),
		usRegion: metaGet(meta, "US Region"),
		latS,
		lonS,
		dcCapacity: metaGet(meta, "DC Capacity"),
		dateFirstOp: metaGet(meta, "Date of First Operation"),
		typeInstallation: metaGet(meta, "Type of Installation"),
	};
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function fetchJson(url) {
	const resp = await fetch(url, { cache: "no-store" });
	if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);
	return resp.json();
}

async function fetchText(url) {
	const resp = await fetch(url, { cache: "no-store" });
	if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);
	return resp.text();
}

/**
 * Runs the full verification suite against one uploaded CSV file (a File
 * object from an <input type=file> or drop event) and reports progress via
 * onProgress(stage: string).
 *
 * Returns { perFile: [[level,label,msg],...], cross: [[level,label,msg],...], filename }
 */
async function verifyUploadedFile(file, onProgress) {
	const filename = file.name;
	const text = await file.text();

	onProgress?.("Parsing CSV…");
	const { meta, tsRows, rawLines } = parseCsvText(text);

	const perFile = [];
	const push = (label, results) => {
		for (const [level, msg] of results) perFile.push([level, label, msg]);
	};

	onProgress?.("Checking energy sum…");
	push("Energy sum", checkEnergySum(meta, tsRows, DEFAULT_ENERGY_TOL));

	onProgress?.("Checking lat/lon against country (Nominatim)…");
	const bboxCache = new Map();
	push("Lat/lon in country", await checkLatLonInCountry(meta, bboxCache));

	push("Timestamp match", checkBeginEndTimestamps(meta, tsRows));
	push("Time series gaps", checkNoGaps(tsRows));
	push("Parseable kWh", checkParseableKwh(tsRows));
	push("Non-negative kWh", checkNonNegative(tsRows));
	push("Carbon reduction", checkCarbonReduction(meta));
	push("Filename timestamp", checkFilenameTimestamps(filename, meta));
	push("Date of first operation", checkDateOfFirstOperation(meta));
	push("Date range within year", checkDateRangeWithinYear(meta));
	push("ISO date format", checkDateFormats(meta, tsRows));
	push("No trailing empty rows", checkNoTrailingEmptyRows(rawLines));

	onProgress?.("Loading contracts.json…");
	let contractsLookup = null;
	try {
		contractsLookup = loadContractsLookup(await fetchJson(CONTRACTS_URL));
	} catch (e) {
		perFile.push(["FAIL", "Contracts amount", `Could not load contracts.json: ${e.message}`]);
	}
	if (contractsLookup) push("Contracts amount", checkContractsAmount(filename, meta, contractsLookup));

	onProgress?.("Fetching sibling files for cross-file checks…");
	const fileList = await fetchJson(FILES_JSON_URL);
	const siblingNames = fileList.filter((f) => f !== filename);

	const uploadedRecord = buildFileRecord(filename, meta);
	const fileRecords = [uploadedRecord];
	const cross = [];

	let fetched = 0;
	for (const name of siblingNames) {
		fetched++;
		onProgress?.(`Fetching sibling files for cross-file checks… (${fetched}/${siblingNames.length})`);
		try {
			const siblingText = await fetchText(DATA_DIR + encodeURIComponent(name));
			const { meta: siblingMeta } = parseCsvText(siblingText);
			fileRecords.push(buildFileRecord(name, siblingMeta));
		} catch (e) {
			cross.push(["WARN", `Could not fetch/parse ${name} for cross-file checks: ${e.message}`]);
		}
	}

	const allLocalBasenames = new Set([...fileList, filename]);

	const pushCross = (label, results) => {
		for (const [level, msg] of results) cross.push([level, label, msg]);
	};
	const overlapIssues = checkAllTemporalOverlaps(fileRecords);
	pushCross("Temporal/spatial overlap", overlapIssues.length
		? overlapIssues
		: [["PASS", "No temporal or spatial overlaps detected"]]);
	if (contractsLookup) {
		pushCross("Contracts coverage", checkContractsCoverage(allLocalBasenames, contractsLookup));
	}
	pushCross("Metadata field consistency", checkMetaKeysConsistency(fileRecords));
	pushCross("Project metadata consistency", checkProjectMetadataConsistency(fileRecords));

	return { perFile, cross, filename };
}

window.verifyUploadedFile = verifyUploadedFile;
