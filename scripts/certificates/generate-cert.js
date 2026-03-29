const fs = require('fs');
const QRCode = require('qrcode');
const puppeteer = require('puppeteer');
const path = require('path');

async function generateCertificate(data) {
	let html = fs.readFileSync('cert-template.html', 'utf8');
	const css = fs.readFileSync('certificate.css', 'utf8');

	// Inline the CSS to ensure it loads in Puppeteer
	html = html.replace(
		/<link rel="stylesheet" href="certificate\.css">/,
		`<style>${css}</style>`
	);

	for (const [key, value] of Object.entries(data)) {
		if (key === 'HASH') {
			// Build the Polygonscan URL and generate a self-contained SVG QR code
			const qrUrl = `https://polygonscan.com/tx/${value}`;
			const qrSvg = await QRCode.toString(qrUrl, {
				type: 'svg',
				width: 100,
				margin: 1,
				color: { dark: '#000000', light: '#ffffff' }
			});

			// Wrap in an <img>-like inline element with the right CSS class
			html = html.replaceAll(`{{QR}}`, `${qrSvg}`);
		} else {
			html = html.replaceAll(`{{${key}}}`, value);
		}
	}

	const filename = `out/certificate_${data.BLOCK}.html`;
	fs.writeFileSync(filename, html);
	console.log(`Generated: ${filename}`);

	return filename;
}

async function generatePDF(htmlFile, outputFile) {
	const browser = await puppeteer.launch({
		args: ['--no-sandbox', '--disable-setuid-sandbox']
	});
	const page = await browser.newPage();

	// Load the local HTML file
	await page.goto(`file://${path.resolve(htmlFile)}`, { waitUntil: 'networkidle0' });
	// 'networkidle0' waits for fonts/QR code image to fully load before printing

	// Force screen media type to prevent color space issues in PDF
	await page.emulateMediaType('screen');

	await page.pdf({
		path: outputFile,
		format: 'A4',
		landscape: true,
		printBackground: true, // crucial — prints background colors/gradients
	});

	await browser.close();
	console.log(`PDF saved: ${outputFile}`);
}

async function generateAllCertificates() {
	const contracts = JSON.parse(fs.readFileSync('../../web/js/contracts.json', 'utf8'));
	const companies = JSON.parse(fs.readFileSync('../../web/js/companies.json', 'utf8'));

	const eventMap = {
		mint: 'Generation',
		transfer: 'Sale',
		retire: 'Retirement',
		return: 'Exchange'
	};

	const actionMap = {
		mint: 'generated',
		transfer: 'sold',
		retire: 'retired',
		return: 'exchanged'
	};

	const unitMap = {
		REC: 'MWh',
		CC: 'tCO2e'
	};

	function formatDate(timestamp) {
		const date = new Date(parseInt(timestamp) * 1000);
		const day = date.getDate();
		const month = date.toLocaleString('en-US', { month: 'long' });
		const year = date.getFullYear();
		return `${day} ${month} ${year}`;
	}

	function findCompanyName(address) {
		const company = companies.find(c => c.address.toLowerCase() === address.toLowerCase());
		return company ? company.name : address;
	}

	for (const contract of contracts) {
		// Skip untracked tokens, like South Carolina Solar Tax Credits
		if (!contract.address) {
			continue
		}

		for (const tx of contract.transactions) {
			if (tx.ignore === true) {
				continue;
			}

			let data = {
				EVENT: eventMap[tx.action] || tx.action,
				DATE: formatDate(tx.timeStamp),
				ACTION: actionMap[tx.action] || tx.action,
				QUANTITY: String(tx.amount),
				ASSET: contract.name + (tx.amount>1 ? 's' : ''),
				UNIT: unitMap[contract.superclass] || contract.superclass,
				COMMODITY: contract.commodity,
				BLOCK: tx.blockNumber,
				HASH: tx.hash
			};

			switch (tx.action) {
				case 'mint':
					data['USER'] = findCompanyName(tx.to)
					filename = await generateCertificate(data);
					await generatePDF(filename, `out/certificate_${tx.blockNumber}.pdf`);
					break

				case 'transfer':
					data['USER'] = findCompanyName(tx.from)
					filename = await generateCertificate(data);
					await generatePDF(filename, `out/certificate_sale_${tx.blockNumber}.pdf`);

					data['EVENT'] = 'Purchase'
					data['USER'] = findCompanyName(tx.to)
					data['ACTION'] = 'purchased'
					filename = await generateCertificate(data);
					await generatePDF(filename, `out/certificate_purchase_${tx.blockNumber}.pdf`);
					break

				case 'retire':
					data['USER'] = findCompanyName(tx.from)
					filename = await generateCertificate(data);
					await generatePDF(filename, `out/certificate_${tx.blockNumber}.pdf`);
					break

				case 'return':
					// TODO: Returns/exchanges always happen in pairs. Need to decide what to do.
					break
			}

			

			if (tx.action === 'transfer') {
				var data2 = data
				data2['EVENT'] = 'Purchase'
				data2['USER'] = findCompanyName(tx.to)
				data2['ACTION'] = 'purchased'
				filename = await generateCertificate(data2);
				await generatePDF(filename, `out/certificate_${tx.blockNumber}.pdf`);
			}
		}
	}
}

generateAllCertificates();