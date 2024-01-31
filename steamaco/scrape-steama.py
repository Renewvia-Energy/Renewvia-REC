import requests, sys, json, csv, os

URL_BASE = 'https://api.steama.co'
AUTH_TOKEN = sys.argv[1]
FN_METERS = 'meters.csv'

def json2csv(json_arr, csv_fn):
	alreadyStarted = os.path.exists(csv_fn)
	with open(csv_fn, 'a' if alreadyStarted else 'w') as data_file:
		csv_writer = csv.writer(data_file)
		if not alreadyStarted:
			csv_writer.writerow(json_arr[0].keys())
		for obj in json_arr:
			csv_writer.writerow(obj.values())

def getCustomers():
	meters = []
	hasNext = True
	pg = 284
	while (hasNext):
		try:
			resp = requests.get('{urlBase}/customers/?page={pg}'.format(urlBase=URL_BASE, pg=str(pg)), headers={ 'Authorization': 'Token {}'.format(AUTH_TOKEN) })
			if resp.status_code == 200:
				resp_json = json.loads(resp.content.decode())
				hasNext = resp_json['next'] is not None
				meters+= resp_json['results']
			else:
				print('Error printing customers page {pg}! Response code {code}'.format(pg=pg, code=resp.status_code))
				print(str(resp))
				exit(0)
			pg+= 1
		except Exception as e:
			print('Failed to send or get response from SteamaCo. Check your internet connection. More details:')
			print(str(e))
			exit(0)
	return meters

if __name__ == '__main__':
	print(getCustomers())