#!/usr/bin/python3
# update contracts json data with information from api

import requests
import json
import os

# keys to use in the Api call
API_KEY = "FV7VI88AT9SBQDZU3WYWGPWZNVDUEY9RTW"
# WALLET_ADDR = "0x9Db94E89DB9798544494a71C01E3552D6adE79bE"

# get keys from environment variables
# set environment variable  < export API_KEY="your key">
# API_KEY = os.environ.get('API_KEY')
# WALLET_ADDR = os.environ.get("WALLET_ADDR")

# pass keys as arguments when running the script  => ./updateData <your API_KEY> <your WALLET_address>
# API_KEY = os.sys.argv[1]
# WALLET_ADDR = os.sys.argv[2]

# url to get all contracts from github
contractsUrl = 'https://raw.githubusercontent.com/Faith-Kimongo/Renewvia-REC/main/R-REC-NEW/contracts.json'
walletsUrl = 'https://raw.githubusercontent.com/Faith-Kimongo/Renewvia-REC/main/R-REC-NEW/companies.json'

print('Getting data from github ...')

# get all the companies(wallets)
response = requests.get(walletsUrl)
allwallets = response.json()

# use requests module to send get request and get json data from github contracts.json file
response = requests.get(contractsUrl)
allContracts = response.json()

# transaction url for api

print('Retrieving Transactions from API ...')
allTransactions = []
for wallet  in allwallets:
    TRANSACTION_URL = f"https://api.bscscan.com/api?module=account&action=tokentx&address={wallet['address']}&page=1&offset=0&startblock=0&endblock=999999999&sort=asc&apikey={API_KEY}"
    response = requests.get(TRANSACTION_URL)
    transPerwallet = (response.json()['result'])
    for trans in transPerwallet:
        allTransactions.append(trans)
    transPerwallet = []

print('Sorting transactions per contact ...')
for contract in allContracts:
    contract['transactions'] = []
    for trans in allTransactions:
        if contract['address'].lower() == trans['contractAddress'].lower() and contract['company_address'].lower() == trans['to'].lower():
            contract['transactions'].append(trans)

# add action (method)
for contract in allContracts:
    if contract['transactions']:
        for trans in contract['transactions']:
            if trans['from'].lower() == '0x6E61B86d97EBe007E09770E6C76271645201fd07'.lower():
                trans['method'] = 'Transaction'
            elif trans['from'].lower() == '0x0000000000000000000000000000000000000000'.lower():
                trans['method'] = 'Generation'
            else:
                trans['method'] = 'Retirement'

# get latest transaction method save to contract action
for contract in allContracts:
    if contract['transactions']:
        max = 0
        latestTransaction = {}
        for trans in contract['transactions']:
            time = int(trans['timeStamp'])
            if time > max:
                max = time
                latestTransaction = trans
        contract['action'] = latestTransaction['method']





print('Setting the QTY value ...')
for contract in allContracts:
    QTY_URL = f"https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress={contract['address']}&address={contract['company_address']}&tag=latest&apikey={API_KEY}"

    response = requests.get(QTY_URL)
    data = response.json()
    api_qty = data['result']
    if api_qty == "0":
        qty = 0
    else:
        qty = data['result'].strip("0")
        qty = int(qty)
    contract['qty'] = qty

allContracts = json.dumps(allContracts)

print('Updating contracts.json file ...')

# write new contracts with updated value to contracts.json file
with open('contracts.json', 'w') as file:
    file.write(allContracts)

print('contracts.json file updated')

print('Pushing the contract.json file to github ...')
# push contracts.json to git
os.system("git add contracts.json")
os.system("git commit -m 'updated contracts.json'")
os.system("git push")
# print ('Done')