# Renewvia-REC
 Blockchain-Based Renewable Energy Credits

## Start
To interact with R-RECs, you will need to sign up for a MetaMask cryptocurrency wallet, add the Binance Smart Chain (BSC) network to your wallet, and purchase some Binance Coin (BNB) to pay for gas fees.

### Get a MetaMask wallet
Visit [MetaMask.io](https://metamask.io/). Download and install the browser extension and sign up for an account.

### Add the Binance Smart Chain (BSC) network to your wallet
Follow the instructions in this [BSC News](https://www.bsc.news/post/connecting-metamask-wallet-to-the-binance-smart-chain) article to connect your MetaMask wallet to the Binance Smart Chain.

### Purchase Binance Coin (BNB) to pay gas fees
Download the Crypto.com app on your smartphone. Sign up for an account. Buy enough BNB to pay for gas fees for the transactions. I would recommend purchasing about 0.1 BNB, which is about $40 USD at the time of writing.

After purchasing BNB, you will need to transfer it to your MetaMask wallet. Follow the instructions in [this DC post](https://decentralizedcreator.com/transfer-crypto-from-crypto-com-to-metamask/) to transfer BNB from your Crypto.com account to your MetaMask wallet.

### And that's it!
You're ready to trade R-RECs!

## Initialize the R-REC Blockchain
If you are making your own R-REC blockchain, follow these steps after completing the above instructions:

### Deploy R-REC from Remix Ethereum IDE
1. Navigate to the [Remix Ethereum IDE](https://remix.ethereum.org/).
2. Upload [RenewviaREC.sol](https://github.com/Renewvia-Energy/Renewvia-REC/blob/main/RenewviaREC.sol) from this repository into the default workspace. This can be done either by clicking the "Load a local file into the current workspace" icon and selecting `RenewviaREC.sol` from your local machine or by clicking the "Create New File" icon and copy-pasting the contents of `RenewviaREC.sol` into the Remix file editor. Both icons are located on the left side of the screen underneath the `default_workspace` selector.
4. Click the "Solidity compiler" option in the left sidebar. Select the compiler with the name `0.8.4+commit...`. Then, click the "Compile RenewviaREC.sol" button. Wait for the compiler to finish and a green checkmark to appear on the "Solidity compiler" icon.
5. Once the compiler has finished running, click the "Deploy and run transactions" icon in the left sidebar. Change the environment to "Injected Web3" and click the "Next" button on the resulting MetaMask pop-up. Then, click the "Connect" button on the MetaMask pop-up.
6. Confirm that your MetaMask account number has now appeared in the "ACCOUNT" selector.
7. Select "RenewviaREC - RenewviaREC.sol" from the "CONTRACT" selector.
8. Enter the initial supply of R-RECs in the input box to the right of the "Deploy" button with preview text `uint256 premint`. For example, to have an initial supply of 10,000 R-RECs, enter `10000` into the input box. You will be able to mint more R-RECs later.
9. Click the "Deploy" button and pay the gas fees using via the MetaMask pop-up.
10. Click the green checkmark at the bottom of the window, scroll to the bottom of the Remix terminal, and copy the transaction `hash`. Save this for later.

### Verify the transaction on BSC Scan
1. Navigate to [BSCScan.com](https://bscscan.com/) and enter the transaction hash from Remix into the search bar at the top of the page. Press the "Enter" button on your keyboard.
2. Confirm that the Status of the transaction is "Success."

### Add R-RECs to your MetaMask wallet
1. Copy the contract address from the "Interacted With (To):" field from BSCScan. The contract address should be a hexadecimal hyperlink, and you can copy it by clicking the "Copy" icon to the right of the address.
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
7. Confirm the payment of BNB for gas fees for the transaction.

You have successfully sent R-RECs. Your recipient will now be able to view them in their MetaMask wallet.

## To receive R-RECs
These instructions allow you to view any R-RECs you have in your MetaMask wallet. You only need to follow these instructions when you receive your first R-RECs. After you complete these steps once, you only need to open your MetaMask wallet to view your R-RECs.

1. Open your MetaMask wallet by clicking the MetaMask extension icon in your browser. Scroll to the bottom of the extension pop-up and click "Import tokens."
2. Paste the following contract address into the "Token Contract Address" field: TODO
3. Confirm that the remaining fields have been autofilled and click "Next."
4. Click "Add Token."

You should now see your R-RECs in your MetaMask wallet.
