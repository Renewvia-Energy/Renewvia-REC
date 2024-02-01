import requests, sys, json, csv, os, datetime, functools

URL_BASE = 'https://api.steama.co'
AUTH_TOKEN = sys.argv[1]
FN_READINGS = 'readings.csv'
TYPE_IMA_CONSUMPTION_MAX = 0.055 # MWh

class Customer:
	def __init__(self, row):
		self.id = row[0]
		self.site = row[1]
		self.timesteps = [datetime.fromisoformat(timestamp) for timestamp in row[2::2]]
		self.readings = [float(energy) for energy in row[3::2]]

	def getFirstYear(self):
		return min(self.timesteps).year
	
	def getTotalEnergyConsumption(self, year):
		return functools.reduce(lambda total, t: total + self.readings[t] if self.timesteps.year is year else total, range(self.readings))
	
	def getTypeIMAConsumption(self, year):
		return min(self.getTotalEnergyConsumption(year)/1000, TYPE_IMA_CONSUMPTION_MAX)
	
	def getTypeIMBConsumption(self, year):
		return max(self.getTotalEnergyConsumption(year)/1000-TYPE_IMA_CONSUMPTION_MAX, 0)
	
if __name__ == '__main__':
	with open(FN_READINGS, 'r') as readings_file:
		reader = csv.reader(readings_file)
		for row in reader:
			cust = Customer(row)
			