#!/usr/bin/env python3
"""
Generate all hourly datetimes for a given year and save to a text file.
Format: ISO 8601 with timezone offset (e.g., 2021-12-15T08:00:00-05:00)
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import argparse

def generate_year_datetimes(year, timezone_str='UTC', output_file=None):
	"""
	Generate every hour of the specified year in the given timezone.
	
	Args:
		year: The year for which to generate datetimes (int)
		timezone_str: Timezone name (e.g., 'America/New_York', 'UTC')
		output_file: Output filename (defaults to 'datetimes_{year}.txt')
	"""
	if output_file is None:
		output_file = f'datetimes_{year}.txt'
	
	# Create timezone object
	tz = ZoneInfo(timezone_str)
	
	# Start at the beginning of the year
	current_dt = datetime(year, 1, 1, 0, 0, 0, tzinfo=tz)
	
	# End at the beginning of the next year
	end_dt = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=tz)
	
	# Open file for writing
	with open(output_file, 'w') as f:
		while current_dt < end_dt:
			# Write datetime in ISO format
			f.write(current_dt.isoformat() + '\n')
			
			# Move to next hour
			current_dt += timedelta(hours=1)
	
	print(f"Generated datetimes for {year} in timezone {timezone_str}")
	print(f"Output saved to: {output_file}")
	
	# Calculate total hours
	with open(output_file, 'r') as f:
		num_lines = sum(1 for _ in f)
	print(f"Total hours written: {num_lines}")


if __name__ == "__main__":
	# Argparse
	parser = argparse.ArgumentParser(prog='Generate Datetimes', description='Create a file of all datetimes, hour by hour, for a given year')
	parser.add_argument('year', type=int, help='The year for which to generate datetimes')
	parser.add_argument('-t', '--timezone', default='UTC', help='Timezone name (e.g., "America/New_York", "UTC")')
	parser.add_argument('-o', '--output', default=None, help='Output filename (defaults to "datetimes_{year}.txt")')
	args = parser.parse_args()
	
	# Generate the datetimes
	generate_year_datetimes(args.year, args.timezone, args.output)
	
	# You can also specify a custom output file:
	# generate_year_datetimes(2021, 'America/New_York', 'my_custom_file.txt')
	
	# Other timezone examples:
	# generate_year_datetimes(2021, 'UTC')
	# generate_year_datetimes(2021, 'America/Los_Angeles')
	# generate_year_datetimes(2021, 'Europe/London')