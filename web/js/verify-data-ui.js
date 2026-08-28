"use strict";

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const statusLine = document.getElementById("status-line");
const resetBtn = document.getElementById("reset-btn");
const errorBox = document.getElementById("error-box");
const verdictBanner = document.getElementById("verdict-banner");
const verdictIcon = document.getElementById("verdict-icon");
const verdictText = document.getElementById("verdict-text");
const summaryCounts = document.getElementById("summary-counts");
const perFileSection = document.getElementById("per-file-section");
const perFileReport = document.getElementById("per-file-report");
const crossFileSection = document.getElementById("cross-file-section");
const crossFileReport = document.getElementById("cross-file-report");

const ICONS = {
	PASS: "fa-circle-check",
	FAIL: "fa-circle-xmark",
	WARN: "fa-triangle-exclamation",
	SKIP: "fa-circle-minus",
};

function setStatus(text, spinning) {
	statusLine.innerHTML = "";
	if (spinning) {
		const spinner = document.createElement("div");
		spinner.className = "spinner";
		statusLine.appendChild(spinner);
	}
	if (text) {
		const span = document.createElement("span");
		span.textContent = text;
		statusLine.appendChild(span);
	}
}

function resetReport() {
	errorBox.classList.remove("show");
	errorBox.textContent = "";
	verdictBanner.classList.remove("show", "pass", "warn", "fail");
	summaryCounts.innerHTML = "";
	perFileSection.style.display = "none";
	crossFileSection.style.display = "none";
	perFileReport.innerHTML = "";
	crossFileReport.innerHTML = "";
	resetBtn.classList.remove("show");
}

function renderChecks(container, rows) {
	container.innerHTML = "";
	for (const [level, label, msg] of rows) {
		const row = document.createElement("div");
		row.className = "check-row";

		const badge = document.createElement("span");
		badge.className = `badge ${level.toLowerCase()}`;
		badge.innerHTML = `<i class="fas ${ICONS[level] || "fa-circle"}"></i> ${level}`;
		row.appendChild(badge);

		const text = document.createElement("div");
		text.className = "check-text";
		text.innerHTML = `<span class="check-label">${escapeHtml(label)}:</span><span class="check-msg">${escapeHtml(msg)}</span>`;
		row.appendChild(text);

		container.appendChild(row);
	}
}

function escapeHtml(s) {
	const div = document.createElement("div");
	div.textContent = String(s);
	return div.innerHTML;
}

function renderSummary(perFile, cross) {
	const counts = { PASS: 0, FAIL: 0, WARN: 0, SKIP: 0 };
	for (const [level] of [...perFile, ...cross]) counts[level]++;

	summaryCounts.innerHTML = "";
	for (const level of ["PASS", "FAIL", "WARN", "SKIP"]) {
		const pill = document.createElement("span");
		pill.className = `count-pill ${level.toLowerCase()}`;
		pill.textContent = `${level}: ${counts[level]}`;
		summaryCounts.appendChild(pill);
	}

	verdictBanner.classList.add("show");
	if (counts.FAIL > 0) {
		verdictBanner.classList.add("fail");
		verdictIcon.className = "fas fa-circle-xmark";
		verdictText.textContent = `Found ${counts.FAIL} failing check${counts.FAIL === 1 ? "" : "s"} — this file needs attention before it's submitted.`;
	} else if (counts.WARN > 0) {
		verdictBanner.classList.add("warn");
		verdictIcon.className = "fas fa-triangle-exclamation";
		verdictText.textContent = `No failures, but ${counts.WARN} warning${counts.WARN === 1 ? "" : "s"} to review.`;
	} else {
		verdictBanner.classList.add("pass");
		verdictIcon.className = "fas fa-circle-check";
		verdictText.textContent = "All checks passed.";
	}
}

async function handleFile(file) {
	if (!file) return;
	resetReport();
	setStatus(`Verifying ${file.name}…`, true);

	try {
		const { perFile, cross } = await window.verifyUploadedFile(file, (stage) => setStatus(stage, true));
		setStatus(`Done checking ${file.name}.`, false);

		perFileSection.style.display = "";
		crossFileSection.style.display = "";
		renderChecks(perFileReport, perFile);
		renderChecks(crossFileReport, cross);
		renderSummary(perFile, cross);
	} catch (e) {
		setStatus("", false);
		errorBox.textContent = `Could not verify this file:\n${e.message}`;
		errorBox.classList.add("show");
	}
	resetBtn.classList.add("show");
}

fileInput.addEventListener("change", () => {
	handleFile(fileInput.files[0]);
});

["dragenter", "dragover"].forEach((evt) => {
	dropzone.addEventListener(evt, (e) => {
		e.preventDefault();
		dropzone.classList.add("dragover");
	});
});
["dragleave", "drop"].forEach((evt) => {
	dropzone.addEventListener(evt, (e) => {
		e.preventDefault();
		dropzone.classList.remove("dragover");
	});
});
dropzone.addEventListener("drop", (e) => {
	const file = e.dataTransfer.files[0];
	if (file) handleFile(file);
});

resetBtn.addEventListener("click", () => {
	fileInput.value = "";
	setStatus("", false);
	resetReport();
});
