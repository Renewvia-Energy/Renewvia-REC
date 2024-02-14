import requests, sys, json, csv, os, math
from timeit import default_timer as timer

URL_BASE = 'https://api.steama.co'
AUTH_TOKEN = sys.argv[1]
FN_CUSTOMERS = 'customers.csv'
FN_READINGS = 'readings.csv'

# Get an array of all meter readings of a given customer
def getMeterReadings(customerID):
	# Initialize empty array of meter readings to be returned
	readings = []

	# Whether there is another page of meter readings
	hasNext = True

	# Current page number
	pg = 1
	while hasNext:
		try:
			print('\tLoading Readings Page {pg}'.format(id=customerID, pg=pg))

			# Send request to get next page of meter readings of customer
			resp = requests.get(
				'{base}/customers/{id}/utilities/1/readings/?page={pg}&start_time=1970-01-01T00:00:00'.format(base=URL_BASE, id=customerID, pg=pg),
				headers={ 'Authorization': 'Token {}'.format(AUTH_TOKEN) }
			)

			# If the response is good
			if resp.status_code == 200:
				# Load the response into a JSON object
				resp_json = json.loads(resp.content.decode())

				# Determine if there is another page based on the 'next' field
				hasNext = resp_json['next'] is not None

				# Add all readings to the readings array for returning
				for reading in resp_json['results']:
					readings.append({
						'timestamp': reading['timestamp'],
						'usage_amount': reading['usage_amount']
					})
			
			# Error handling for 404 responses, etc.
			else:
				print('Error printing readings from customer {id}, page {pg}! Response code {code}'.format(id=customerID, pg=pg, code=resp.status_code))
				print(str(resp))
				exit(0)

		# Error handling
		except Exception as e:
			print('Failed to send or get response from SteamaCo. Check your internet connection. More details:')
			print(str(e))
			exit(0)

		# Increment page number
		pg+= 1

	return readings

if __name__ == '__main__':
	# If the readings CSV already exists, get the last customer in the file so you can skip
	lastCustomer = None
	if os.path.exists(FN_READINGS):
		with open(FN_READINGS, 'r') as readings_file:
			reader = csv.reader(readings_file)
			for row in reader:
				lastCustomer = row[0]
		print('Will skip to customer {}'.format(lastCustomer))

	# Count number of customers
	num_customers = 0
	with open(FN_CUSTOMERS, 'r') as cust_file:
		reader = csv.DictReader(cust_file)
		for cust in reader:
			num_customers+= 1

	# For each customer, record their positive meter readings
	with open(FN_CUSTOMERS, 'r') as cust_file:
		reader = csv.DictReader(cust_file)
		stillSkipping = bool(lastCustomer)
		numSkipped = 0
		startTime = timer()
		for c, cust in enumerate(reader):
			# Skip until you reach the last customer you already recorded
			if stillSkipping:
				stillSkipping = lastCustomer != cust['id']
				numSkipped+= 1
				print('{progress:.0f}% Complete. Already recorded customer {id}'.format(progress=math.floor(100*c/num_customers), id=cust['id']))

			# Start recording new customers
			else:
				# Report progress and estimated time remaining
				if c!=numSkipped:
					timeLeft = (timer()-startTime)/(c-numSkipped)*(num_customers-c)
					units = 'seconds'
					if timeLeft > 120:
						timeLeft/= 60
						units = 'minutes'
						if timeLeft > 120:
							timeLeft/= 60
							units = 'hours'
							if timeLeft > 48:
								timeLeft/= 24
								units = 'days'
					print('{progress:.0f}% Complete. Recording customer {id} to file. Estimated time to completion: {timeLeft:.0f} {units}.'.format(math.floor(progress=100*(c-1)/num_customers), id=cust['id'], timeLeft=timeLeft, units=units))
				else:
					print('{progress:.0f}% Complete. Recording customer {id} to file:'.format(progress=math.floor(100*(c-1)/num_customers), id=cust['id']))

				# Get a list of all the meter readings, including time stamp and ID, for this iteration's customer
				readings = getMeterReadings(cust['id'])

				# Record the all positive customer meter readings, along with their ID and site name
				with open(FN_READINGS, 'a') as readings_file:
					writer = csv.writer(readings_file)
					row = [cust['id'], cust['site_name'], cust['user_type']]
					for reading in readings:
						if float(reading['usage_amount']) != 0:
							row+= [reading['timestamp'], reading['usage_amount']]
					writer.writerow(row)