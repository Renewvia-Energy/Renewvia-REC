import requests, sys, json, csv, os

URL_BASE = 'https://api.steama.co'
AUTH_TOKEN = sys.argv[1]
FN_CUSTOMERS = 'customers.csv'
FN_READINGS = 'readings.csv'

def json2csv(json_arr, csv_fn):
	alreadyStarted = os.path.exists(csv_fn)
	with open(csv_fn, 'a' if alreadyStarted else 'w') as data_file:
		csv_writer = csv.writer(data_file)
		if not alreadyStarted:
			csv_writer.writerow(json_arr[0].keys())
		for obj in json_arr:
			csv_writer.writerow(obj.values())

def getMeterReadings(customerID):
	readings = []
	hasNext = True
	pg = 1
	while hasNext:
		try:
			print('Loading Customer {id}, Readings Page {pg}'.format(id=customerID, pg=pg))
			resp = requests.get(
				'{base}/customers/{id}/utilities/1/readings/?page={pg}&start_time=1970-01-01T00:00:00'.format(base=URL_BASE, id=customerID, pg=pg),
				headers={ 'Authorization': 'Token {}'.format(AUTH_TOKEN) }
			)
			if resp.status_code == 200:
				resp_json = json.loads(resp.content.decode())
				hasNext = resp_json['next'] is not None
				for reading in resp_json['results']:
					readings.append({
						'timestamp': reading['timestamp'],
						'usage_amount': reading['usage_amount']
					})
			else:
				print('Error printing readings from customer {id}, page {pg}! Response code {code}'.format(id=customerID, pg=pg, code=resp.status_code))
				print(str(resp))
				exit(0)
		except Exception as e:
			print('Failed to send or get response from SteamaCo. Check your internet connection. More details:')
			print(str(e))
			exit(0)
		pg+= 1
	return readings

if __name__ == '__main__':
	lastCustomer = None
	if os.path.exists(FN_READINGS):
		with open(FN_READINGS, 'r') as readings_file:
			reader = csv.reader(readings_file)
			for row in reader:
				lastCustomer = row[0]
		print('Will skip to customer {}'.format(lastCustomer))
	with open(FN_CUSTOMERS, 'r') as cust_file:
		reader = csv.DictReader(cust_file)
		stillSkipping = bool(lastCustomer)
		for cust in reader:
			if stillSkipping:
				stillSkipping = lastCustomer != cust['id']
				print('Already recorded customer {}'.format(cust['id']))
			else:
				readings = getMeterReadings(cust['id'])
				with open(FN_READINGS, 'a') as readings_file:
					writer = csv.writer(readings_file)
					row = [cust['id']]
					for reading in readings:
						if float(reading['usage_amount']) != 0:
							row+= [reading['timestamp'], reading['usage_amount']]
					writer.writerow(row)
					print(len(row))
				print('Finished recording customer {} to file'.format(cust['id']))
				# exit(0)