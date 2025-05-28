# Instructions
This guide assumes you are running Ubuntu. Ensure you have cloned this repository onto your computer and are in the parent directory before you begin.

## Start
To interact with R-RECs, you will need to sign up for a MetaMask cryptocurrency wallet, add a Polygon network to your wallet, and purchase some Polygon MATIC to pay for gas fees.

### Get a MetaMask wallet
Visit [MetaMask.io](https://metamask.io/). Download and install the browser extension and sign up for an account.

### Add a Polygon network to your wallet
Follow the instructions in this [Polygon Knowledge Layer](https://docs.polygon.technology/tools/wallets/metamask/add-polygon-network/) article to connect your MetaMask wallet to a Polygon network.

When adding a Polygon network, you can choose between a testnet or mainnet. Testnets (like Amoy) are free to use with test tokens that have no real value, making them perfect for development and testing. Mainnets require real POL (Polygon's native token) for transactions and are used for actual deployments. For initial testing and learning, start with a testnet; when you're ready to deploy your production application, you'll need to purchase POL and connect to the mainnet.

### Purchase MATIC (POL) to pay gas fees
#### For Mainnet (Real Deployments)
Download the Crypto.com app on your smartphone and sign up for an account. Purchase enough POL to pay for gas fees for your transactions. I recommend starting with approximately 20 POL, which costs around $5 USD at the time of writing. After purchasing POL, transfer it to your MetaMask wallet by following the withdrawal instructions in [this DC post](https://decentralizedcreator.com/transfer-crypto-from-crypto-com-to-metamask/).

#### For Testnet (Development and Testing)
To get free test POL for the Amoy testnet, use a [Polygon faucet](https://faucet.polygon.technology/). Connect your MetaMask wallet, select Amoy as the network, and request test tokens. These tokens have no real value but allow you to test your application without spending actual money.

### Install NPX
We recommend using the [Node Version Manager (NVM)](https://github.com/nvm-sh/nvm) to install and manage Node. At the time of writing, you can run a fresh install using:
```bash
cd
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash
source .bashrc
nvm install node
```

Confirm the installation using `npx -v`. The expected output should be a version number, e.g., `10.5.0`.

### Install Foundry
Follow the [installation instruction in Foundry Book](https://book.getfoundry.sh/getting-started/installation) to install Foundry.

### And that's it!
You're ready to trade R-RECs!

## Deploy R-REC Using Foundry
1. Navigate to the `contracts` folder of the repository.

2. Run `cp .env.example .env` to create a new environment file.

2. Add your information to the `.env` file you just created:
    1. [Create a Polygonscan account](https://docs.polygonscan.com/getting-started/creating-an-account) and [copy your Polygonscan API key](https://docs.polygonscan.com/getting-started/viewing-api-usage-statistics) into `ETHERSCAN_API_KEY`.
    2. [Copy your MetaMask account private key](https://support.metamask.io/configure/accounts/how-to-export-an-accounts-private-key/) into `PRIVATE_KEY`. Ensure the private key starts with `0x`.
    3. [Copy your MetaMask account public address](https://support.metamask.io/start/how-to-copy-your-metamask-account-public-address-/) into `OWNER`. Ensure the address starts with `0x`.

3. Run the following command in the terminal install the required Foundry dependencies: `forge install`

4. Edit the `DeployNewContract.s.sol` script in the `script` folder according to its comments, updating the import path to point to your desired contract and updating the `FILENAME` constant to match your contract filename.

5. Deploy your contract:
   ```bash
   forge clean
   forge script script/DeployNewContract.s.sol --rpc-url polygon -vvvv
   ```

   **Options:**
   - To use the Amoy testnet instead of the Polygon mainnet, replace `polygon` with `amoy`
   - To actually broadcast the transaction and deploy to the blockchain, add the `--broadcast --sender $OWNER --verify` flags (this will use your tokens). Run `source .env` before running the script or replace `$OWNER` with the owner's account address.

6. Save the output addresses displayed after successful deployment:
   - Proxy address
   - Implementation address

7. Verify the transaction on Polygonscan. Navigate to [PolygonScan](https://polygonscan.com/) if you deployed on the mainnet or [Amoy Polygonscan](https://amoy.polygonscan.com/) if you used the testnet and enter the proxy contract address you saved from the previous step into the search bar at the top of the page. Press the "Enter" button on your keyboard. Confirm that the contract exists on the blockchain.

## Minting New R-RECs Using Foundry
1. Navigate to the `contracts` folder of the repository and confirm the `.env` variables from the previous section are correct.

2. Open the script file `script/Mint.s.sol` in your preferred code editor and modify the following variables according to your needs:
   - `PROXY`: Replace with the contract address you want to mint from. While testing, use the contract proxy address from the previous section. Existing R-REC contract addresses can be found in `web/js/contracts.json`, but you have to have the owner's private key to mint new tokens to them.
   - `RECIPIENT`: Replace with the wallet address that should receive the newly minted R-RECs.
   - `AMOUNT`: Replace with the number of tokens you want to mint.
   - `V_DATA`: Replace with the URL to the verification data for these R-RECs.

3. Run the minting script:
   ```bash
   forge clean
   forge script script/Mint.s.sol --rpc-url polygon -vvvv
   ```
   
   **Options:**
   - To use the Amoy testnet instead of the Polygon mainnet, replace `polygon` with `amoy`
   - To actually broadcast the transaction and deploy to the blockchain, add the `--broadcast --sender $OWNER --verify` flags (this will use your tokens)

4. Once the transaction is confirmed, you can verify it by refreshing the PolygonScan or Amoy PolygonScan contract page from the previous section.

## View R-RECs in your MetaMask wallet
1. If you created your own R-REC contract, copy the proxy contract address you saved previously. The official R-REC contract addresses are located in [contracts.json](https://github.com/Renewvia-Energy/Renewvia-REC/blob/main/web/js/contracts.json).
2. Open your MetaMask wallet by clicking the MetaMask extension icon in your browser. Scroll to the bottom of the extension pop-up and click "Import tokens."
3. Paste the contract address into the "Token Contract Address" field.
4. Confirm that the remaining fields have been autofilled and click "Next."
5. Click "Add Token."

You now have R-RECs in your MetaMask wallet.

## To send R-RECs
Once you have R-RECs in your MetaMask wallet, you can send them to other MetaMask wallets using the following steps:
1. Open your MetaMask wallet by clicking the MetaMask extension icon in your browser.
2. Select your R-RECs from the list of tokens in your wallet.
3. Click the "Send" icon.
4. Enter the account address of the recipient. Your account address can be found at the top of the front page of the MetaMask extension pop-up.
5. Enter the amount of tokens you would like to send to the recipient.
6. Click "Next."
7. Confirm the payment for gas fees for the transaction.

You have successfully sent R-RECs. Your recipient will now be able to view them in their MetaMask wallet.
