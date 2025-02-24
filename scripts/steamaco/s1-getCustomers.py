import requests, sys, json, csv, os

URL_BASE = 'https://api.steama.co'
AUTH_TOKEN = sys.argv[1]
FN_CUSTOMERS = 'customers.csv'

# Converts a JSON object to a CSV file and writes it
def json2csv(json_arr, csv_fn):
	alreadyStarted = os.path.exists(csv_fn)
	with open(csv_fn, 'a' if alreadyStarted else 'w') as data_file:
		csv_writer = csv.writer(data_file)
		if not alreadyStarted:
			csv_writer.writerow(json_arr[0].keys())
		for obj in json_arr:
			csv_writer.writerow(obj.values())

if __name__ == '__main__':
	hasNext = True	# Whether there is another page
	pg = 1	# Current page number
	while (hasNext):
		try:
			print('Reading Meters Page {}...'.format(pg))

			# Send request to get next page of customers
			resp = requests.get('{urlBase}/customers/?page={pg}'.format(urlBase=URL_BASE, pg=str(pg)), headers={ 'Authorization': 'Token {}'.format(AUTH_TOKEN) })

			# If you get a good response
			if resp.status_code == 200:
				# Load the response into a JSON object
				resp_json = json.loads(resp.content.decode())

				# Determine whether there is another page based on what the 'next' field says
				hasNext = resp_json['next'] is not None

				# Append the customers' data as rows to the output CSV
				json2csv(resp_json['results'], FN_CUSTOMERS)

			# Error handling for 404 responses, etc.
			else:
				print('Error printing customers page {pg}! Response code {code}'.format(pg=pg, code=resp.status_code))
				print(str(resp))
				exit(0)

			# Increment the page number
			pg+= 1
		
		# Error handling
		except Exception as e:
			print('Failed to send or get response from SteamaCo. Check your internet connection. More details:')
			print(str(e))
			exit(0)