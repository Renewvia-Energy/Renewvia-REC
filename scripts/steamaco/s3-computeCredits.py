import sys, csv, datetime, functools

URL_BASE = 'https://api.steama.co'
AUTH_TOKEN = sys.argv[1]
FN_READINGS = 'readings.csv'
FN_CREDITS = 'credits.csv'

class Customer:
	TYPE_IMA_CONSUMPTION_MAX = 0.055 # MWh
	TYPE_I_USER_TYPE = 'RES'
	EF = {
		'IMA': 2.72,	# tCO2e/MWh
		'IMB': 0.8,	# tCO2e/MWh
		'II': 0.8	# tCO2e/MWh
	}

	def __init__(self, row):
		self.id = row[0]
		self.site = row[1]
		self.type = row[2]
		self.timesteps = [datetime.datetime.fromisoformat(timestamp[:-1]) for timestamp in row[3::2]]
		self.readings = [float(energy) for energy in row[4::2]]

	def __str__(self):
		return 'Customer {id} of site {site} is of type {type} with {qty} readings'.format(id=self.id, site=self.site, type=self.type, qty=len(self.timesteps))

	def hasReadings(self):
		return len(self.timesteps) > 0

	def getType(self):
		return 1 if self.type == Customer.TYPE_I_USER_TYPE else 2

	def getFirstYear(self):
		return min(self.timesteps).year
	
	def getLastYear(self):
		return max(self.timesteps).year
	
	def getEnergyConsumptionByYear(self, year):
		return functools.reduce(lambda total, t: (total + self.readings[t]) if self.timesteps[t].year == year else total, range(len(self.readings)), 0)
	
	def getTypeIMAConsumptionByYear(self, year):
		return min(self.getEnergyConsumptionByYear(year)/1000, Customer.TYPE_IMA_CONSUMPTION_MAX) if self.getType() == 1 else 0
	
	def getTypeIMBConsumptionByYear(self, year):
		return max(self.getEnergyConsumptionByYear(year)/1000-Customer.TYPE_IMA_CONSUMPTION_MAX, 0) if self.getType() == 1 else 0
	
	def getTypeIIConsumptionByYear(self, year):
		return self.getEnergyConsumptionByYear(year) if self.getType() == 2 else 0
	
	def getTypeIMAConsumption(self):
		return functools.reduce(lambda total, y: total + self.getTypeIMAConsumptionByYear(y), range(self.getFirstYear(), self.getLastYear()+1), 0) if self.hasReadings() else 0
	
	def getTypeIMBConsumption(self):
		return functools.reduce(lambda total, y: total + self.getTypeIMBConsumptionByYear(y), range(self.getFirstYear(), self.getLastYear()+1), 0) if self.hasReadings() else 0
	
	def getTypeIIConsumption(self):
		return functools.reduce(lambda total, y: total + self.getTypeIIConsumptionByYear(y), range(self.getFirstYear(), self.getLastYear()+1), 0) if self.hasReadings() else 0
	
	def getEmissionsReductionByYear(self, year):
		return self.getTypeIMAConsumptionByYear(year)*Customer.EF['IMA'] + self.getTypeIMBConsumptionByYear(year)*Customer.EF['IMB'] + self.getTypeIIConsumptionByYear(year)*Customer.EF['II']
	
	def getEmissionsReduction(self):
		return self.getTypeIMAConsumption()*Customer.EF['IMA'] + self.getTypeIMBConsumption()*Customer.EF['IMB'] + self.getTypeIIConsumption()*Customer.EF['II']
	
if __name__ == '__main__':
	# Get the years corresponding to the earliest and latest meter readings recorded
	firstYear = float('inf')
	lastYear = float('-inf')
	with open(FN_READINGS, 'r') as readings_file:
		reader = csv.reader(readings_file)
		for row in reader:
			cust = Customer(row)
			if cust.hasReadings():
				firstYear = min(firstYear, cust.getFirstYear())
				lastYear = max(lastYear, cust.getLastYear())
	print('Computing emissions reduction for years {} through {}'.format(firstYear, lastYear))

	# Create column headers for each year's Type I-MA, I-MB, and II consumptions as well as the total emissions reduction
	columnHeaders = ['Customer ID', 'Site', 'Customer Type']
	for y in range(firstYear, lastYear+1):
		columnHeaders+= [header.format(y) for header in ['{} Type I-MA Consumption', '{} Type I-MB Consumption', '{} Type II Consumption', '{} Emissions Reduction']]
	columnHeaders+= ['Total Type I-MA Consumption', 'Total Type I-MB Consumption', 'Total Type II Consumption', 'Total Emissions Reduction']

	# For each customer, write a row summarizing their yearly consumption and emissions reduction
	with open(FN_READINGS, 'r') as readings_file:
		reader = csv.reader(readings_file)
		with open(FN_CREDITS, 'w') as credits_file:
			writer = csv.DictWriter(credits_file, fieldnames=columnHeaders)
			writer.writeheader()
			totalEmissionsReduction = 0
			for row in reader:
				cust = Customer(row)
				custSummary = {
					'Customer ID': cust.id,
					'Site': cust.site,
					'Customer Type': cust.type,
					'Total Type I-MA Consumption': cust.getTypeIMAConsumption(),
					'Total Type I-MB Consumption': cust.getTypeIMBConsumption(),
					'Total Type II Consumption': cust.getTypeIIConsumption(),
					'Total Emissions Reduction': cust.getEmissionsReduction()
				}
				for y in range(firstYear, lastYear+1):
					custSummary['{} Type I-MA Consumption'.format(y)] = cust.getTypeIMAConsumptionByYear(y)
					custSummary['{} Type I-MB Consumption'.format(y)] = cust.getTypeIMBConsumptionByYear(y)
					custSummary['{} Type II Consumption'.format(y)] = cust.getTypeIIConsumptionByYear(y)
					custSummary['{} Emissions Reduction'.format(y)] = cust.getEmissionsReductionByYear(y)
				writer.writerow(custSummary)
				totalEmissionsReduction+= cust.getEmissionsReduction()
	
	print('Total Emissions Reduction: {} tCO2e'.format(totalEmissionsReduction))