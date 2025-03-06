# Renewvia-REC
Blockchain-Based Carbon Assets

For more information, please visit [our website](https://www.r-recs.com/).

## Repository Overview
```
.
|
+-- contracts
|   +-- lib/                                Foundry and OpenZeppelin dependencies in blockchain contracts
|   +-- script
|       +-- DeployNewContract.s.sol         Foundry script to deploy a new class of R-RECs to the blockchain
|       +-- Mint.s.sol                      Foundry script to mint tokens from an already-deployed contract on the blockchain
|   +-- src
|       +-- BlacklistableUpgradeable.sol    Abstract class from NicksAPPS enabling blacklist functionality
|       +-- RenewviaREC.sol                 Main R-REC contract
|   +-- test
|       +-- RenewviaREC.t.sol               Foundry test script for R-REC functionality
|   +-- .env.example                        Example environment file to be copied into .env and edited with user information
|   +-- .gitignore                          Foundry-specific gitignore
|   +-- foundry.toml                        Foundry configuration file
|   +-- install.sh                          Installs Foundry and OpenZeppelin dependencies
|   +-- reee.sh                             Runs deploy or mint scripts with optional broadcast mechanism
|
+-- scripts
|   +-- steamaco/                           Scripts to scrape data from SteamaCo database
|   +-- updateData.py                       Scrapes blockchain to update contracts.json
|   +-- updateData.sh                       Runs updateData.py inside of Python virtual environment (WIP)
|
+-- verification_data/                      Directory containing renewable energy generation data for verification
|
+-- web
|   +-- css/                                Stylesheets for web pages
|   +-- images/                             Images used in web pages
|   +-- js
|       +-- abi.json                        Blockchain application binary interface for RenewviaREC.sol
|       +-- account.js                      Client-side-rendering Vue.JS for account page
|       +-- companies.json                  Database of account information
|       +-- contracts.json                  Local copy of blockchain transactions
|       +-- index.js                        Basic JS animations for homepage
|       +-- marketplace.js                  Client-side-rendering Vue.JS for marketplace page (WIP)
|   +-- pages
|       +-- account.html                    Account page with Vue.JS components
|       +-- marketplace.html                Marketplace page with Vue.JS components
|   +-- scss/                               SCSS to be compiled into CSS
|
+-- .gitattributes
+-- .gitignore
+-- .gitmodules
+-- 404.html                                Default 404 error page
+-- CNAME                                   Canonical URL for homepage, used by GitHub Pages
+-- index.html                              Homepage
+-- instructions.md                         Guide for deploying R-REC contracts
+-- LICENSE                                 GPLv3
+-- README.md                               This document
+-- robots.txt                              Implementation of Robots Exclusion Protocol
+-- sitemap.xml                             List of pages on www.r-recs.com
+-- Standard.pdf                            Standard governing R-RECs
```