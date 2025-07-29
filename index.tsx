/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Chat } from "@google/genai";

// --- TYPE DEFINITIONS ---
type FinancialRecord = { [key: string]: number | string | null };
type RatioResult = { [key:string]: (number | string)[] };
type CompanyData = { name: string; records: FinancialRecord[]; ratios: RatioResult; };
type ChatMessage = { role: 'user' | 'model'; content: string; };

type AiAnalysisSummaries = {
    profitability: string;
    utilization: string;
    liquidity: string;
    leverage: string;
    growth: string;
    cash_flow: string;
    valuation: string;
    forecast: string;
};
type AiAnalysisContent = {
    main: string;
    summaries: AiAnalysisSummaries;
};
type AiAnalyses = {
    english: AiAnalysisContent;
    arabic: AiAnalysisContent;
};

interface ChartInstance {
    destroy(): void;
    data: {
        labels?: (string | number | Date)[];
        datasets: any[];
    };
    options: any;
    resize(): void;
    update(mode?: 'none'): void;
    toBase64Image(type?: string, quality?: number): string;
}

// Declare global objects. These assume the libraries are loaded from script tags.
declare var Chart: {
    new(item: HTMLCanvasElement, config: any): ChartInstance;
};
declare var XLSX: any;
declare var jspdf: { jsPDF: any };
declare var html2canvas: (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>;

// --- MAIN APPLICATION LOGIC ---
const App = {
    // --- DOM Elements (initialized in init method) ---
    companyInputsContainer: null as HTMLDivElement | null,
    addCompanyBtn: null as HTMLButtonElement | null,
    analyzeBtn: null as HTMLButtonElement | null,
    downloadCsvBtn: null as HTMLButtonElement | null,
    downloadXlsxBtn: null as HTMLButtonElement | null,
    benchmarkCheckbox: null as HTMLInputElement | null,
    benchmarkSelectorContainer: null as HTMLDivElement | null,
    benchmarkSelector: null as HTMLSelectElement | null,
    benchmarkHint: null as HTMLParagraphElement | null,
    loader: null as HTMLDivElement | null,
    loadingText: null as HTMLParagraphElement | null,
    errorContainer: null as HTMLDivElement | null,
    errorMessage: null as HTMLSpanElement | null,
    resultsSection: null as HTMLDivElement | null,
    comparisonControls: null as HTMLDivElement | null,
    navLinks: null as NodeListOf<HTMLAnchorElement> | null,
    forecastNavLink: null as HTMLAnchorElement | null,
    valuationNavLink: null as HTMLAnchorElement | null,
    contentPanels: null as NodeListOf<HTMLDivElement> | null,
    forecastCheckbox: null as HTMLInputElement | null,
    forecastCheckboxContainer: null as HTMLDivElement | null,

    correctionModal: null as HTMLDivElement | null,
    correctionModalContent: null as HTMLDivElement | null,
    correctionFormContainer: null as HTMLDivElement | null,
    confirmCorrectionBtn: null as HTMLButtonElement | null,
    cancelCorrectionBtn: null as HTMLButtonElement | null,
    
    apiKeyInput: null as HTMLInputElement | null,

    // Chat elements - will be populated after analysis
    chatSection: null as HTMLDivElement | null,
    chatHistoryContainer: null as HTMLDivElement | null,
    chatLoader: null as HTMLDivElement | null,
    chatForm: null as HTMLFormElement | null,
    chatInput: null as HTMLInputElement | null,
    chatSendBtn: null as HTMLButtonElement | null,
    boundChatSubmit: null as ((e: Event) => void) | null,

    // --- State ---
    chartInstances: {} as { [key: string]: ChartInstance },
    ai: null as GoogleGenAI | null,
    companyInputCounter: 1,
    currentLanguage: 'English' as 'English' | 'Arabic',
    aiAnalyses: null as AiAnalyses | null,
    analyzedData: [] as CompanyData[],
    forecastData: null as RatioResult | null,
    hasValuationData: false,
    chat: null as Chat | null,
    chatHistory: [] as ChatMessage[],

    // --- Constants ---
    chartColors: ['#06b6d4', '#fb923c', '#4ade80', '#818cf8', '#f87171', '#a78bfa', '#2dd4bf'],
    REQUIRED_COLUMNS: [
        'Year', 'Net Income', 'Equity', 'Total Assets', 'PP&E',
        'Gross Profit', 'Revenue', 'SG&A', 'Other Operating Expenses', 'EBITDA',
        'Depreciation', 'EBIT', 'Earning Before Tax', 'Tax', 'Interest Expense',
        'Total Interest Bearing Liabilities', 'Interest Bearing Liabilities Only', 'Cash',
        'Accounts Receivable', 'COGS', 'Inventory', 'Accounts Payable',
        'Total Liabilities', 'Current Assets', 'Current Liabilities',
        'Operating Cash Flow', 'Capital Expenditures'
    ],
    OPTIONAL_COLUMNS: ['Market Capitalization', 'Dividends Paid'],
    templateData: [
        {
            'Year': 2021, 'Net Income': 100000, 'Equity': 500000, 'Total Assets': 800000,
            'PP&E': 760000, 'Gross Profit': 300000, 'Revenue': 500000,
            'SG&A': 85000, 'Other Operating Expenses': 65000, 'EBITDA': 150000,
            'Depreciation': 18000, 'EBIT': 132000, 'Earning Before Tax': 117000,
            'Tax': 17000, 'Interest Expense': 15000, 'Total Interest Bearing Liabilities': 260000,
            'Interest Bearing Liabilities Only': 260000, 'Cash': 100000, 'Accounts Receivable': 60000,
            'COGS': 200000, 'Inventory': 80000, 'Accounts Payable': 40000, 'Total Liabilities': 300000,
            'Current Assets': 240000, 'Current Liabilities': 40000,
            'Operating Cash Flow': 140000, 'Capital Expenditures': 30000, 'Market Capitalization': 1000000, 'Dividends Paid': 20000,
        },
        {
            'Year': 2022, 'Net Income': 115000, 'Equity': 530000, 'Total Assets': 850000,
            'PP&E': 805000, 'Gross Profit': 330000, 'Revenue': 550000,
            'SG&A': 90000, 'Other Operating Expenses': 70000, 'EBITDA': 170000,
            'Depreciation': 20000, 'EBIT': 150000, 'Earning Before Tax': 134000,
            'Tax': 19000, 'Interest Expense': 16000, 'Total Interest Bearing Liabilities': 275000,
            'Interest Bearing Liabilities Only': 275000, 'Cash': 120000, 'Accounts Receivable': 65000,
            'COGS': 220000, 'Inventory': 85000, 'Accounts Payable': 45000, 'Total Liabilities': 320000,
            'Current Assets': 270000, 'Current Liabilities': 45000,
            'Operating Cash Flow': 160000, 'Capital Expenditures': 35000, 'Market Capitalization': 1200000, 'Dividends Paid': 25000,
        },
        {
            'Year': 2023, 'Net Income': 140000, 'Equity': 590000, 'Total Assets': 920000,
            'PP&E': 870000, 'Gross Profit': 380000, 'Revenue': 620000,
            'SG&A': 100000, 'Other Operating Expenses': 75000, 'EBITDA': 205000,
            'Depreciation': 25000, 'EBIT': 180000, 'Earning Before Tax': 163500,
            'Tax': 23500, 'Interest Expense': 16500, 'Total Interest Bearing Liabilities': 280000,
            'Interest Bearing Liabilities Only': 280000, 'Cash': 150000, 'Accounts Receivable': 72000,
            'COGS': 240000, 'Inventory': 90000, 'Accounts Payable': 50000, 'Total Liabilities': 330000,
            'Current Assets': 312000, 'Current Liabilities': 50000,
            'Operating Cash Flow': 190000, 'Capital Expenditures': 40000, 'Market Capitalization': 1500000, 'Dividends Paid': 30000,
        },
    ],

    init() {
        // Initialize DOM elements
        this.companyInputsContainer = document.getElementById('company-inputs-container') as HTMLDivElement;
        this.addCompanyBtn = document.getElementById('add-company-btn') as HTMLButtonElement;
        this.analyzeBtn = document.getElementById('analyze-button') as HTMLButtonElement;
        this.downloadCsvBtn = document.getElementById('download-csv-btn') as HTMLButtonElement;
        this.downloadXlsxBtn = document.getElementById('download-xlsx-btn') as HTMLButtonElement;
        this.benchmarkCheckbox = document.getElementById('benchmark-checkbox') as HTMLInputElement;
        this.benchmarkSelectorContainer = document.getElementById('benchmark-selector-container') as HTMLDivElement;
        this.benchmarkSelector = document.getElementById('benchmark-selector') as HTMLSelectElement;
        this.benchmarkHint = document.getElementById('benchmark-hint') as HTMLParagraphElement;
        this.loader = document.getElementById('loader') as HTMLDivElement;
        this.loadingText = document.getElementById('loading-text') as HTMLParagraphElement;
        this.errorContainer = document.getElementById('error-container') as HTMLDivElement;
        this.errorMessage = document.getElementById('error-message') as HTMLSpanElement;
        this.resultsSection = document.getElementById('results-section') as HTMLDivElement;
        this.comparisonControls = document.getElementById('comparison-controls') as HTMLDivElement;
        this.navLinks = document.querySelectorAll('.nav-link') as NodeListOf<HTMLAnchorElement>;
        this.forecastNavLink = document.querySelector('a[href="#forecast-content"]') as HTMLAnchorElement;
        this.valuationNavLink = document.querySelector('a[href="#valuation-content"]') as HTMLAnchorElement;
        this.contentPanels = document.querySelectorAll('.content-panel') as NodeListOf<HTMLDivElement>;
        this.forecastCheckbox = document.getElementById('forecast-checkbox') as HTMLInputElement;
        this.forecastCheckboxContainer = document.getElementById('forecast-checkbox-container') as HTMLDivElement;
        this.correctionModal = document.getElementById('correction-modal') as HTMLDivElement;
        this.correctionModalContent = document.getElementById('correction-modal-content') as HTMLDivElement;
        this.correctionFormContainer = document.getElementById('correction-form-container') as HTMLDivElement;
        this.confirmCorrectionBtn = document.getElementById('confirm-correction-btn') as HTMLButtonElement;
        this.cancelCorrectionBtn = document.getElementById('cancel-correction-btn') as HTMLButtonElement;
        this.apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;

        // Initialize AI client - will be set when user provides API key
        this.ai = null;
        
        // Disable analyze button until API key is provided
        this.analyzeBtn.disabled = true;
        
        // Add event listeners
        this.addCompanyBtn.addEventListener('click', this.addCompanyInput.bind(this));
        this.companyInputsContainer.addEventListener('click', this.handleContainerClick.bind(this));
        this.companyInputsContainer.addEventListener('change', this.handleFileChange.bind(this));
        this.analyzeBtn.addEventListener('click', this.handleAnalysis.bind(this));
        this.downloadCsvBtn.addEventListener('click', this.handleDownloadCsv.bind(this));
        this.downloadXlsxBtn.addEventListener('click', this.handleDownloadXlsx.bind(this));
        this.benchmarkCheckbox.addEventListener('change', this.handleBenchmarkToggle.bind(this));
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => this.handleNavClick(e as MouseEvent));
        });
        this.apiKeyInput.addEventListener('input', this.handleApiKeyInput.bind(this));
        this.updateAnalysisOptionsVisibility();
    },

    handleApiKeyInput() {
        const apiKey = this.apiKeyInput.value.trim();
        if (apiKey) {
            try {
                this.ai = new GoogleGenAI({ apiKey });
                this.analyzeBtn.disabled = false;
                this.hideError();
            } catch (error) {
                this.showError(`Invalid API key. Please check your Google AI API key.`);
                this.analyzeBtn.disabled = true;
            }
        } else {
            this.ai = null;
            this.analyzeBtn.disabled = true;
        }
    },

    updateAnalysisOptionsVisibility() {
        const inputRows = this.companyInputsContainer.querySelectorAll('.company-input-row');
        const isBenchmark = this.benchmarkCheckbox.checked;

        if (inputRows.length === 1 && !isBenchmark) {
            this.forecastCheckboxContainer.classList.remove('hidden');
        } else {
            this.forecastCheckboxContainer.classList.add('hidden');
        }
    },

    handleBenchmarkToggle() {
        if (this.benchmarkCheckbox.checked) {
            this.benchmarkSelectorContainer.classList.remove('hidden');
            this.benchmarkHint.classList.remove('hidden');
            this.addCompanyBtn.disabled = false;
        } else {
            this.benchmarkSelectorContainer.classList.add('hidden');
            this.benchmarkHint.classList.add('hidden');
        }
        this.updateAnalysisOptionsVisibility();
    },
    
    addCompanyInput() {
        const newRow = document.createElement('div');
        newRow.className = 'company-input-row flex flex-col sm:flex-row items-center gap-4';
        const inputId = `file-input-${this.companyInputCounter++}`;
        newRow.innerHTML = `
            <input type="text" placeholder="Enter Company Name" class="company-name-input flex-grow w-full sm:w-auto">
             <div class="file-upload-wrapper">
                <input type="file" accept=".csv, .xlsx, .pdf" class="company-file-input" id="${inputId}">
                <label for="${inputId}" class="btn-secondary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span>Upload File</span>
                </label>
                <span class="file-name-display">No file selected</span>
            </div>
            <button type="button" class="remove-company-btn" aria-label="Remove company">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        `;
        this.companyInputsContainer.appendChild(newRow);
        this.updateAnalysisOptionsVisibility();
    },

    handleContainerClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const removeBtn = target.closest('.remove-company-btn');
        if (removeBtn) {
            removeBtn.closest('.company-input-row')?.remove();
            this.updateAnalysisOptionsVisibility();
        }
    },
    
    handleFileChange(event: Event) {
        const target = event.target as HTMLInputElement;
        if (target.matches('.company-file-input')) {
            const fileNameDisplay = target.parentElement?.querySelector('.file-name-display');
            if (fileNameDisplay) {
                fileNameDisplay.textContent = target.files?.[0]?.name || 'No file selected';
            }
        }
    },

    handleNavClick(event: MouseEvent) {
        event.preventDefault();
        const targetLink = event.currentTarget as HTMLAnchorElement;
        const targetId = targetLink.getAttribute('href').substring(1);

        this.navLinks.forEach(link => link.classList.remove('active'));
        targetLink.classList.add('active');

        this.contentPanels.forEach(panel => {
            panel.classList.toggle('hidden', panel.id !== targetId);
        });
        
        // Ensure chart is visible and update it to fix potential rendering issues
        const chart = this.chartInstances[targetId.replace('-content', '')];
        if (chart) {
            chart.resize();
            chart.update();
        }
    },

    async handleAnalysis() {
        // Check if API key is provided
        if (!this.ai) {
            this.showError('Please enter your Google AI API key first.');
            return;
        }
        
        this.resetUI();
        const inputRows = this.companyInputsContainer.querySelectorAll('.company-input-row');
    
        if (this.benchmarkCheckbox.checked) {
            await this.handleBenchmarkAnalysis(inputRows);
        } else {
            await this.handleStandardAnalysis(inputRows);
        }
    },

    async handleStandardAnalysis(inputRows: NodeListOf<Element>) {
        this.hasValuationData = false;
        const companyInputs: { name: string, file: File }[] = [];
        let firstInvalidNameInput: HTMLInputElement | null = null;
        let hasIncompleteRow = false;

        // Reset styles
        inputRows.forEach(row => {
            const nameInput = row.querySelector('.company-name-input') as HTMLInputElement;
            nameInput.classList.remove('input-invalid');
            if (nameInput.dataset.originalPlaceholder) {
                nameInput.placeholder = nameInput.dataset.originalPlaceholder;
                delete nameInput.dataset.originalPlaceholder;
            }
        });

        for (const row of inputRows) {
            const nameInput = row.querySelector('.company-name-input') as HTMLInputElement;
            const fileInput = row.querySelector('.company-file-input') as HTMLInputElement;
            const name = nameInput.value.trim();
            const file = fileInput.files?.[0];

            if (!name && !file) {
                continue; // Ignore empty row
            }

            if (name && file) {
                companyInputs.push({ name, file });
            } else if (file && !name) {
                // Prompt for name instead of showing error
                nameInput.classList.add('input-invalid');
                if (!nameInput.dataset.originalPlaceholder) {
                    nameInput.dataset.originalPlaceholder = nameInput.placeholder;
                }
                nameInput.placeholder = 'Please enter a company name';
                if (!firstInvalidNameInput) {
                    firstInvalidNameInput = nameInput;
                }
            } else {
                // Any other combination (e.g., name but no file)
                hasIncompleteRow = true;
            }
        }

        if (firstInvalidNameInput) {
            this.hideError();
            firstInvalidNameInput.focus();
            return; // Stop execution to let user fill the name
        }

        if (hasIncompleteRow) {
            this.showError("Please provide both a name and a file for each company entry.");
            return;
        }

        if (companyInputs.length === 0) {
            this.showError("Please select a file and enter a name for at least one company.");
            return;
        }

        this.showLoader("Reading files...");
        try {
            const fileDataPromises = companyInputs.map(input => this.readFileContent(input.file).catch(e => {
                this.showError(`Could not read file ${input.file.name}: ${e.message}`);
                return null;
            }));
            const fileContents = await Promise.all(fileDataPromises);

            const inputsWithContent = companyInputs
                .map((input, index) => ({
                    name: input.name,
                    fileName: input.file.name,
                    content: fileContents[index],
                }))
                .filter(item => item.content !== null);
            
            if (inputsWithContent.length !== companyInputs.length) {
                this.hideLoader();
                return;
            }

            const analyzedData: CompanyData[] = [];
            for (const input of inputsWithContent) {
                this.showLoader(`Parsing ${input.name}...`);
                let rawRecords = await this.parseFileContent(input.content, input.fileName);
                
                let { records, issues, allValid } = this.validateAndPrepareRecords(rawRecords);
                if (!allValid) {
                    this.hideLoader();
                    const correctedRecords = await this.showCorrectionModal(records, issues, input.name);
                    if (correctedRecords === null) { // User cancelled
                        this.showError(`Analysis for ${input.name} cancelled by user.`);
                        this.hideLoader();
                        return; // Stop the entire analysis
                    }
                    records = correctedRecords;
                    this.showLoader(`Resuming analysis for ${input.name}...`);
                }
                
                if (records.length < 1) {
                    throw new Error(`Input for ${input.name} must have at least 1 period of data for analysis.`);
                }
                
                this.showLoader(`Calculating ratios for ${input.name}...`);
                const {ratios, hasValuationData} = this.calculateAllRatios(records);
                if (hasValuationData) this.hasValuationData = true;
                analyzedData.push({ name: input.name, records, ratios });
            }
            
            this.analyzedData = analyzedData;
            
            this.forecastData = null;
            if (this.analyzedData.length === 1 && this.forecastCheckbox.checked && this.analyzedData[0].records.length >= 3) {
                this.showLoader("Generating financial forecast...");
                this.forecastData = this.calculateForecasts(this.analyzedData[0].ratios, 3);
            }
            
            this.showLoader("Initializing chat...");
            await this.initializeChat(analyzedData);

            this.showLoader("Gemini is analyzing your financials (in English & Arabic)...");
            this.aiAnalyses = await this.getAIAnalysis(analyzedData, this.forecastData);

            this.displayAllResults(analyzedData, this.aiAnalyses);
            this.resultsSection.classList.remove('hidden');
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.hideLoader();
        }
    },
    
    async handleBenchmarkAnalysis(inputRows: NodeListOf<Element>) {
        if (inputRows.length === 0) {
            this.showError("Please provide at least one company file for benchmark analysis.");
            return;
        }
        const industry = this.benchmarkSelector.value;
        if (!industry) {
            this.showError("Please select an industry for the benchmark.");
            return;
        }

        this.showLoader("Processing files...");
        try {
            if (inputRows.length > 1) {
                await this.handleCustomBenchmarkFlow(inputRows, industry);
            } else {
                await this.handleAiBenchmarkFlow(inputRows[0], industry);
            }
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.hideLoader();
        }
    },

    async handleAiBenchmarkFlow(row: Element, industry: string) {
        this.hasValuationData = false;
        const nameInput = row.querySelector('.company-name-input') as HTMLInputElement;
        const fileInput = row.querySelector('.company-file-input') as HTMLInputElement;
        
        // Reset style
        nameInput.classList.remove('input-invalid');
        if (nameInput.dataset.originalPlaceholder) {
            nameInput.placeholder = nameInput.dataset.originalPlaceholder;
            delete nameInput.dataset.originalPlaceholder;
        }

        const name = nameInput.value.trim();
        const file = fileInput.files?.[0];

        if (file && !name) {
            this.hideError();
            nameInput.classList.add('input-invalid');
            if (!nameInput.dataset.originalPlaceholder) {
                nameInput.dataset.originalPlaceholder = nameInput.placeholder;
            }
            nameInput.placeholder = 'Please enter a company name';
            nameInput.focus();
            return;
        }

        if (!name || !file) {
            throw new Error("Please provide a name and a file for the company.");
        }

        this.showLoader(`Reading file ${file.name}...`);
        const fileContent = await this.readFileContent(file);

        this.showLoader(`Parsing ${name}...`);
        let rawRecords = await this.parseFileContent(fileContent, file.name);

        let { records, issues, allValid } = this.validateAndPrepareRecords(rawRecords);
        if (!allValid) {
            this.hideLoader();
            const correctedRecords = await this.showCorrectionModal(records, issues, name);
            if (correctedRecords === null) {
                this.showError("Analysis cancelled.");
                this.hideLoader();
                return;
            }
            records = correctedRecords;
            this.showLoader(`Resuming analysis for ${name}...`);
        }
        
        if (records.length < 1) throw new Error(`Input for ${name} must have at least 1 period of data.`);
        
        this.showLoader(`Calculating ratios for ${name}...`);
        const {ratios: companyRatios, hasValuationData} = this.calculateAllRatios(records);
        if(hasValuationData) this.hasValuationData = true;
        const companyData = { name, records, ratios: companyRatios };

        this.showLoader(`Fetching AI benchmarks for ${industry} industry...`);
        const benchmarkData = await this.getBenchmarkData(industry);

        this.analyzedData = [companyData, benchmarkData];
        
        this.showLoader("Initializing chat...");
        await this.initializeChat(this.analyzedData);

        this.showLoader("Gemini is analyzing your financials (in English & Arabic)...");
        this.aiAnalyses = await this.getAIAnalysis(this.analyzedData);

        this.displayAllResults(this.analyzedData, this.aiAnalyses);
        this.resultsSection.classList.remove('hidden');
    },

    async handleCustomBenchmarkFlow(inputRows: NodeListOf<Element>, industry: string) {
        this.hasValuationData = false;
        const primaryRow = inputRows[0];
        const primaryNameInput = primaryRow.querySelector('.company-name-input') as HTMLInputElement;
        const primaryFileInput = primaryRow.querySelector('.company-file-input') as HTMLInputElement;
        
        // Reset style
        primaryNameInput.classList.remove('input-invalid');
        if (primaryNameInput.dataset.originalPlaceholder) {
            primaryNameInput.placeholder = primaryNameInput.dataset.originalPlaceholder;
            delete primaryNameInput.dataset.originalPlaceholder;
        }
        
        const primaryName = primaryNameInput.value.trim();
        const primaryFile = primaryFileInput.files?.[0];

        if (primaryFile && !primaryName) {
            this.hideError();
            primaryNameInput.classList.add('input-invalid');
            if (!primaryNameInput.dataset.originalPlaceholder) {
                primaryNameInput.dataset.originalPlaceholder = primaryNameInput.placeholder;
            }
            primaryNameInput.placeholder = 'Please enter a company name';
            primaryNameInput.focus();
            return;
        }

        if (!primaryName || !primaryFile) {
            throw new Error("Please provide a name and a file for the primary company (the first entry).");
        }

        // Gather all benchmark files
        const benchmarkRows = Array.from(inputRows).slice(1);
        const benchmarkInputs = benchmarkRows.map((row, index) => {
            const nameInput = row.querySelector('.company-name-input') as HTMLInputElement;
            const fileInput = row.querySelector('.company-file-input') as HTMLInputElement;
            const name = nameInput.value.trim() || `Benchmark Co. ${index + 1}`;
            const file = fileInput.files?.[0];
            return { name, file };
        }).filter(input => input.file); // Only include rows with files

        // Read all files at once (primary + benchmarks)
        this.showLoader(`Reading all files...`);
        const allFilesToRead = [primaryFile, ...benchmarkInputs.map(i => i.file)];
        const allInputsMeta = [{name: primaryName, file: primaryFile}, ...benchmarkInputs];

        const readPromises = allFilesToRead.map((file, i) => this.readFileContent(file).catch(e => {
            this.showError(`Could not read file ${allInputsMeta[i].name} (${file.name}): ${e.message}`);
            return null;
        }));
        const allFileContents = await Promise.all(readPromises);

        if (allFileContents.some(c => c === null)) {
            this.hideLoader();
            return; // Stop if any file failed to read
        }

        const primaryFileContent = allFileContents[0];
        const benchmarkFileContents = allFileContents.slice(1);

        // Process primary company
        this.showLoader(`Parsing primary company: ${primaryName}...`);
        let rawPrimaryRecords = await this.parseFileContent(primaryFileContent, primaryFile.name);
        let { records: primaryRecords, issues: primaryIssues, allValid: primaryIsValid } = this.validateAndPrepareRecords(rawPrimaryRecords);

        if (!primaryIsValid) {
            this.hideLoader();
            const corrected = await this.showCorrectionModal(primaryRecords, primaryIssues, primaryName);
            if (corrected === null) {
                this.showError("Analysis cancelled because primary company data is incomplete.");
                this.hideLoader();
                return;
            }
            primaryRecords = corrected;
            this.showLoader("Resuming analysis...");
        }

        if (primaryRecords.length < 1) throw new Error(`Input for ${primaryName} must have at least 1 period of data.`);

        this.showLoader(`Calculating ratios for ${primaryName}...`);
        const {ratios: primaryRatios, hasValuationData} = this.calculateAllRatios(primaryRecords);
        if(hasValuationData) this.hasValuationData = true;
        const primaryCompanyData = { name: primaryName, records: primaryRecords, ratios: primaryRatios };

        // Process benchmark companies
        this.showLoader(`Calculating custom benchmark...`);
        const ratioNames = Object.keys(this.getRatioCategories()).flatMap(cat => this.getRatioCategories()[cat]);
        const latestYearRatios: { [key: string]: number[] } = {};
        ratioNames.forEach(name => latestYearRatios[name] = []);
        
        for (const [index, benchmarkInput] of benchmarkInputs.entries()) {
            const { name } = benchmarkInput;
            const fileContent = benchmarkFileContents[index];
            const fileName = benchmarkInput.file.name;

            this.showLoader(`Processing benchmark company: ${name}...`);
            let rawRecords = await this.parseFileContent(fileContent, fileName);
            let { records, issues, allValid } = this.validateAndPrepareRecords(rawRecords);
            
            if(!allValid) {
                this.hideLoader();
                const corrected = await this.showCorrectionModal(records, issues, name);
                if (corrected === null) {
                    this.showLoader(`Skipping ${name} due to cancellation and resuming analysis...`);
                    continue; // Skip this benchmark company
                }
                records = corrected;
                this.showLoader(`Resuming analysis for ${name}...`);
            }
            
            const {ratios} = this.calculateAllRatios(records); // Don't care about valuation data for benchmark
            const lastIndex = ratios['Year'].length - 1;

            if (lastIndex < 0) continue;

            for (const ratioName of ratioNames) {
                const value = ratios[ratioName]?.[lastIndex];
                if (typeof value === 'number' && !isNaN(value)) {
                    latestYearRatios[ratioName].push(value);
                }
            }
        }

        const benchmarkRatios: RatioResult = { 'Year': ['Benchmark'] };
        for (const ratioName of ratioNames) {
            const values = latestYearRatios[ratioName];
            const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            benchmarkRatios[ratioName] = [average];
        }

        const customBenchmarkData = {
            name: `${industry} (Custom Benchmark)`,
            records: [],
            ratios: benchmarkRatios
        };

        this.analyzedData = [primaryCompanyData, customBenchmarkData];
        
        this.showLoader("Initializing chat...");
        await this.initializeChat(this.analyzedData);

        this.showLoader("Gemini is analyzing your financials (in English & Arabic)...");
        this.aiAnalyses = await this.getAIAnalysis(this.analyzedData);

        this.displayAllResults(this.analyzedData, this.aiAnalyses);
        this.resultsSection.classList.remove('hidden');
    },

    validateAndPrepareRecords(initialRecords: FinancialRecord[]): { records: FinancialRecord[], issues: { [year: string]: string[] }, allValid: boolean } {
        const issues: { [year: string]: string[] } = {};
        let allValid = true;
    
        // Get all unique column headers from all records to handle optional columns
        const allHeaders = new Set<string>();
        initialRecords.forEach(rec => Object.keys(rec).forEach(h => allHeaders.add(h.trim())));

        const records = initialRecords.map(rec => {
            const newRecord: FinancialRecord = {};
            allHeaders.forEach(col => {
                 // Find the original key in the record, might have different spacing
                const originalKey = Object.keys(rec).find(k => k.trim() === col);
                if (!originalKey) {
                    newRecord[col] = null;
                    return;
                }
                const val = rec[originalKey];
                if (val === undefined || val === null || val === '') {
                    newRecord[col] = null;
                } else {
                    if (typeof val === 'string') {
                        const num = parseFloat(val.replace(/[,\s]/g, ''));
                        newRecord[col] = isNaN(num) ? null : num;
                    } else {
                        newRecord[col] = val;
                    }
                }
            });
            return newRecord;
        });
    
        records.sort((a, b) => (Number(a.Year) || 0) - (Number(b.Year) || 0));
    
        records.forEach((record, index) => {
            const year = record['Year'];
            const yearKey = (typeof year === 'number' && year > 1000) ? String(year) : `Period ${index + 1}`;
            
            const periodIssues: string[] = [];
            // Only validate against the REQUIRED_COLUMNS list
            this.REQUIRED_COLUMNS.forEach(col => {
                const value = record[col];
                if (value === null || typeof value !== 'number' || isNaN(value)) {
                    allValid = false;
                    periodIssues.push(col);
                }
            });
    
            if (periodIssues.length > 0) {
                issues[yearKey] = periodIssues;
            }
        });
    
        return { records, issues, allValid };
    },
    
    showCorrectionModal(records: FinancialRecord[], issues: { [year:string]: string[] }, companyName: string): Promise<FinancialRecord[] | null> {
        return new Promise((resolve) => {
            const modalTitle = this.correctionModal.querySelector('h2') as HTMLHeadingElement;
            modalTitle.innerHTML = `Review &amp; Complete Data for: <span class="text-cyan-400">${companyName}</span>`;
    
            const years = records.map((r, i) => String(r.Year || `Period ${i+1}`));
            let tableHTML = `<div class="overflow-auto"><table class="w-full text-sm"><thead><tr><th class="!bg-slate-800">Metric</th>`;
            years.forEach(year => tableHTML += `<th>${year}</th>`);
            tableHTML += `</tr></thead><tbody>`;
    
            this.REQUIRED_COLUMNS.forEach(colName => {
                tableHTML += `<tr class="hover:bg-gray-700/50"><td class="font-medium text-white !bg-slate-800">${colName}</td>`;
                records.forEach((record, index) => {
                    const yearKey = String(record.Year || `Period ${index+1}`);
                    const isInvalid = issues[yearKey]?.includes(colName);
                    const value = record[colName];
                    const displayValue = (typeof value === 'number' && !isNaN(value)) ? value : '';
                    const inputId = `corr-input-${index}-${colName.replace(/[\s&+/]/g, '')}`;
    
                    tableHTML += `<td>
                        <input type="number" step="any" id="${inputId}" data-record-index="${index}" data-col="${colName}"
                               class="w-full min-w-[120px] bg-slate-900/50 p-2 rounded border ${isInvalid ? 'input-invalid' : 'border-slate-600'} focus:bg-slate-900 focus:border-cyan-500 focus:outline-none"
                               value="${displayValue}" ${colName === 'Year' ? 'placeholder="Year"' : ''}>
                    </td>`;
                });
                tableHTML += `</tr>`;
            });
            tableHTML += `</tbody></table></div>`;
            this.correctionFormContainer.innerHTML = tableHTML;
    
            const onConfirm = () => {
                const newRecords = JSON.parse(JSON.stringify(records));
                const inputs = this.correctionFormContainer.querySelectorAll('input[type="number"]');
                inputs.forEach(input => {
                    const el = input as HTMLInputElement;
                    const recordIndex = parseInt(el.dataset.recordIndex!, 10);
                    const col = el.dataset.col!;
                    newRecords[recordIndex][col] = el.value === '' ? null : parseFloat(el.value);
                });
                cleanup();
                resolve(newRecords);
            };
    
            const onCancel = () => {
                cleanup();
                resolve(null);
            };
            
            const cleanup = () => {
                this.correctionModal.classList.add('hidden');
                this.confirmCorrectionBtn.removeEventListener('click', onConfirm);
                this.cancelCorrectionBtn.removeEventListener('click', onCancel);
            };
    
            this.confirmCorrectionBtn.addEventListener('click', onConfirm, { once: true });
            this.cancelCorrectionBtn.addEventListener('click', onCancel, { once: true });
    
            this.correctionModal.classList.remove('hidden');
        });
    },

    async readFileContent(file: File): Promise<string | ArrayBuffer> {
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.csv')) {
            return file.text();
        } else if (fileName.endsWith('.xlsx')) {
            return file.arrayBuffer();
        } else if (fileName.endsWith('.pdf')) {
            return this.fileToBase64(file);
        }
        throw new Error(`Unsupported file type: ${file.name}. Please use .csv, .xlsx, or .pdf.`);
    },

    async parseFileContent(content: string | ArrayBuffer, fileName: string): Promise<FinancialRecord[]> {
        const lowerFileName = fileName.toLowerCase();
        if (lowerFileName.endsWith('.csv')) {
            return this.parseCSV(content as string);
        } else if (lowerFileName.endsWith('.xlsx')) {
            return this.parseXLSX(content as ArrayBuffer);
        } else if (lowerFileName.endsWith('.pdf')) {
            return this.parsePDFWithAI(content as string, fileName);
        }
        throw new Error("Unsupported file type. Please upload a .csv, .xlsx, or .pdf file.");
    },

    fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    },

    async parsePDFWithAI(base64File: string, fileName: string): Promise<FinancialRecord[]> {
        if (!this.ai) throw new Error("AI client is not initialized.");

        this.showLoader(`Gemini is analyzing PDF: ${fileName}...`);

        const prompt = `You are a highly specialized financial data extraction tool. Your task is to analyze the provided financial statement PDF and extract key financial data for each period (e.g., year) found in the document.

You MUST identify the following required financial metrics for each period: ${this.REQUIRED_COLUMNS.join(', ')}.

Additionally, if available, extract these optional valuation metrics: ${this.OPTIONAL_COLUMNS.join(', ')}.

Your output MUST be a valid JSON array. Each object in the array represents a single financial period and MUST contain all the keys for the required metrics listed above.

**Crucially, if a specific value for a key cannot be found in the document, or if the value is illogical (e.g., text instead of a number), you MUST use a value of \`null\` for that key.** This applies to both required and optional metrics. This is vital for triggering a data correction screen for the user for required fields.

'Year' is mandatory and must be correctly identified for each period. All other values should be numbers or null.

Do not include any explanatory text, comments, or markdown formatting (like \`\`\`json) in your response. The response must be ONLY the raw JSON array string.`;

        try {
            const filePart = { inlineData: { mimeType: 'application/pdf', data: base64File } };
            const textPart = { text: prompt };

            const response = await this.ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [textPart, filePart] },
            });
            
            const responseText = response.text.trim();
            const jsonString = responseText.replace(/^```json\s*/, '').replace(/```$/, '');

            const parsedData = JSON.parse(jsonString) as FinancialRecord[];

            if (!Array.isArray(parsedData) || parsedData.length === 0) {
                throw new Error("AI failed to return valid data. The result is not an array or is empty.");
            }
            
            const allPossibleColumns = [...this.REQUIRED_COLUMNS, ...this.OPTIONAL_COLUMNS];
            return parsedData.map(record => {
                const newRecord: FinancialRecord = {};
                allPossibleColumns.forEach(col => {
                    const value = record[col];
                    if (col === 'Year') {
                        newRecord[col] = Number(value) || null; // Use null if year is invalid
                    } else {
                        if (value === undefined || value === null) {
                            newRecord[col] = null;
                        } else if (typeof value === 'string') {
                            const cleanedValue = value.replace(/[^0-9.-]/g, '');
                            if (cleanedValue === '') {
                                newRecord[col] = null;
                            } else {
                                const num = parseFloat(cleanedValue);
                                newRecord[col] = isNaN(num) ? null : num;
                            }
                        } else if (typeof value === 'number') {
                            newRecord[col] = value;
                        } else {
                            newRecord[col] = null;
                        }
                    }
                });
                return newRecord;
            });

        } catch (e) {
            console.error("Error analyzing PDF with AI:", e);
            throw new Error(`Failed to analyze the PDF with AI. Please ensure the PDF contains clear, tabular financial statements. Original error: ${e.message}`);
        }
    },
    
    handleDownloadCsv() {
        const headers = Object.keys(this.templateData[0]);
        const csvString = [
            headers.join(','),
            ...this.templateData.map(row => headers.map(h => row[h as keyof typeof row]).join(','))
        ].join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'financial_template.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    },

    handleDownloadXlsx() {
        const ws = XLSX.utils.json_to_sheet(this.templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Financials');
        XLSX.writeFile(wb, 'financial_template.xlsx');
    },

    resetUI() {
        this.hideError();
        this.resultsSection.classList.add('hidden');
        this.comparisonControls.classList.add('hidden');
        this.forecastNavLink.classList.add('hidden');
        this.valuationNavLink.classList.add('hidden');
        this.contentPanels.forEach(panel => {
            panel.innerHTML = '';
            panel.classList.add('hidden');
        });
        
        const chatSection = document.getElementById('chat-section');
        if (chatSection) {
            chatSection.classList.add('hidden');
        }

        this.navLinks.forEach(link => link.classList.remove('active'));
        document.querySelector('a[href="#summary-content"]')?.classList.add('active');
        document.getElementById('summary-content')?.classList.remove('hidden');
        this.aiAnalyses = null;
        this.analyzedData = [];
        this.forecastData = null;
        this.hasValuationData = false;
        this.currentLanguage = 'English';
        this.chat = null;
        this.chatHistory = [];

        Object.keys(this.chartInstances).forEach(key => {
            this.chartInstances[key].destroy();
            delete this.chartInstances[key];
        });
    },

    parseCSV(csvText: string): FinancialRecord[] {
        const lines = csvText.trim().split(/\r?\n/);
        const headerLine = lines[0] || '';
        const header = headerLine.split(',').map(h => h.trim());
        const requiredColsInFile = this.REQUIRED_COLUMNS.filter(col => header.includes(col));
        if(requiredColsInFile.length < 2) { // Need at least Year and one other metric
            throw new Error(`CSV file is missing most required columns. Please use the template.`);
        }
        
        return lines.slice(1).map(line => {
            const values = line.split(',');
            const record: FinancialRecord = {};
            header.forEach((h, i) => {
                const value = values[i]?.trim();
                record[h] = value;
            });
            return record;
        });
    },

    parseXLSX(arrayBuffer: ArrayBuffer): FinancialRecord[] {
        const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("XLSX file contains no sheets.");

        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as FinancialRecord[];
        if (jsonData.length === 0) throw new Error("XLSX file is empty.");

        const header = Object.keys(jsonData[0]);
        const requiredColsInFile = this.REQUIRED_COLUMNS.filter(col => header.includes(col));
        if(requiredColsInFile.length < 2) {
             throw new Error(`XLSX file is missing most required columns. Please use the template.`);
        }
        return jsonData;
    },

    calculateAllRatios(data: FinancialRecord[]): {ratios: RatioResult, hasValuationData: boolean} {
        const get = (d: FinancialRecord, key: string) => d[key] as number;
        const safeDiv = (num: number, den: number) => (den === 0 ? 0 : num / den);

        data.sort((a, b) => (a.Year as number) - (b.Year as number));
        const periods = data.map(d => String(d.Year));
        const results: RatioResult = { 'Year': periods };
        
        const hasValuationData = data.length > 0 && data.every(d => d['Market Capitalization'] != null && d['Dividends Paid'] != null);

        const ratioCalculations: { [key: string]: (d: FinancialRecord, prev_d?: FinancialRecord) => number } = {
            'Gross Profit Margin': d => safeDiv(get(d, 'Gross Profit'), get(d, 'Revenue')),
            'Operating Margin': d => safeDiv(get(d, 'EBIT'), get(d, 'Revenue')),
            'EBITDA Margin': d => safeDiv(get(d, 'EBITDA'), get(d, 'Revenue')),
            'EBIT Margin': d => safeDiv(get(d, 'EBIT'), get(d, 'Revenue')),
            'Net Profit Margin': d => safeDiv(get(d, 'Net Income'), get(d, 'Revenue')),
            'Return on Assets (ROA)': d => safeDiv(get(d, 'Net Income'), get(d, 'Total Assets')),
            'Return on Equity (ROE)': d => safeDiv(get(d, 'Net Income'), get(d, 'Equity')),
            'Asset Turnover': d => safeDiv(get(d, 'Revenue'), get(d, 'Total Assets')),
            'Fixed Asset Turnover': d => safeDiv(get(d, 'Revenue'), get(d, 'PP&E')),
            'Inventory Days': d => safeDiv(get(d, 'Inventory'), get(d, 'COGS')) * 365,
            'A/R Days': d => safeDiv(get(d, 'Accounts Receivable'), get(d, 'Revenue')) * 365,
            'A/P Days': d => safeDiv(get(d, 'Accounts Payable'), get(d, 'COGS')) * 365,
            'Cash Days': d => safeDiv(get(d, 'Cash'), get(d, 'Revenue')) * 365,
            'Cash Conversion Cycle': d => (safeDiv(get(d, 'Inventory'), get(d, 'COGS')) * 365) + 
                                       (safeDiv(get(d, 'Accounts Receivable'), get(d, 'Revenue')) * 365) - 
                                       (safeDiv(get(d, 'Accounts Payable'), get(d, 'COGS')) * 365),
            'Current Ratio': d => safeDiv(get(d, 'Current Assets'), get(d, 'Current Liabilities')),
            'Quick Ratio': d => safeDiv(get(d, 'Current Assets') - get(d, 'Inventory'), get(d, 'Current Liabilities')),
            'Debt-to-Equity': d => safeDiv(get(d, 'Total Liabilities'), get(d, 'Equity')),
            'Debt-to-Asset': d => safeDiv(get(d, 'Total Liabilities'), get(d, 'Total Assets')),
            'Interest Coverage': d => safeDiv(get(d, 'EBIT'), get(d, 'Interest Expense')),
            'Debt To EBITDA': d => safeDiv(get(d, 'Total Interest Bearing Liabilities'), get(d, 'EBITDA')),
            'Net Debt to EBITDA': d => safeDiv(get(d, 'Total Interest Bearing Liabilities') - get(d, 'Cash'), get(d, 'EBITDA')),
            'Revenue Growth': (d, p) => p ? safeDiv(get(d, 'Revenue') - get(p, 'Revenue'), get(p, 'Revenue')) : NaN,
            'Net Income Growth': (d, p) => p ? safeDiv(get(d, 'Net Income') - get(p, 'Net Income'), get(p, 'Net Income')) : NaN,
            'EBITDA Growth': (d, p) => p ? safeDiv(get(d, 'EBITDA') - get(p, 'EBITDA'), get(p, 'EBITDA')) : NaN,
            'Total Asset Growth': (d, p) => p ? safeDiv(get(d, 'Total Assets') - get(p, 'Total Assets'), get(p, 'Total Assets')) : NaN,
            'Free Cash Flow (FCF)': d => get(d, 'Operating Cash Flow') - get(d, 'Capital Expenditures'),
            'Operating Cash Flow to Sales': d => safeDiv(get(d, 'Operating Cash Flow'), get(d, 'Revenue')),
            'Cash Flow Coverage Ratio': d => safeDiv(get(d, 'Operating Cash Flow'), get(d, 'Total Interest Bearing Liabilities')),
        };
        
        if (hasValuationData) {
            ratioCalculations['Price-to-Earnings (P/E)'] = d => safeDiv(get(d, 'Market Capitalization'), get(d, 'Net Income'));
            ratioCalculations['Price-to-Sales (P/S)'] = d => safeDiv(get(d, 'Market Capitalization'), get(d, 'Revenue'));
            ratioCalculations['Dividend Yield'] = d => safeDiv(get(d, 'Dividends Paid'), get(d, 'Market Capitalization'));
        }

        for (const ratioName in ratioCalculations) {
            results[ratioName] = data.map((d, i) => ratioCalculations[ratioName](d, data[i-1]));
        }
        return {ratios: results, hasValuationData};
    },

    linearRegression(x: number[], y: number[]): { m: number; b: number } {
        const n = y.length;
        let sum_x = 0, sum_y = 0, sum_xy = 0, sum_xx = 0;
    
        for (let i = 0; i < n; i++) {
            sum_x += x[i];
            sum_y += y[i];
            sum_xy += (x[i] * y[i]);
            sum_xx += (x[i] * x[i]);
        }
    
        const slope = (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x);
        const intercept = (sum_y - slope * sum_x) / n;
    
        return { m: isNaN(slope) ? 0 : slope, b: isNaN(intercept) ? 0 : intercept };
    },

    calculateForecasts(ratios: RatioResult, periods: number): RatioResult {
        const historicalYears = (ratios['Year'] as string[]).map(Number).filter(y => !isNaN(y));
        if (historicalYears.length === 0) return ratios;
    
        const lastYear = Math.max(...historicalYears);
        const futureYears = Array.from({ length: periods }, (_, i) => lastYear + i + 1);
        
        const newYears = [...historicalYears.map(String), ...futureYears.map(y => `${y} (F)`)];
        const forecastResult: RatioResult = { 'Year': newYears };
    
        const x_values = historicalYears.map((_, i) => i);
    
        for (const ratioName in ratios) {
            if (ratioName === 'Year') continue;
            
            // Do not forecast growth rates as they are too volatile for linear regression
            if (ratioName.includes('Growth')) {
                forecastResult[ratioName] = [...ratios[ratioName], ...Array(periods).fill(NaN)];
                continue;
            }
    
            const y_values = (ratios[ratioName] as number[]).filter(v => typeof v === 'number' && !isNaN(v));
    
            if (y_values.length < 2) {
                forecastResult[ratioName] = [...ratios[ratioName], ...Array(periods).fill(NaN)];
                continue;
            }
            
            const { m, b } = this.linearRegression(x_values, y_values);
    
            const forecastValues = Array.from({ length: periods }, (_, i) => m * (x_values.length + i) + b);
            
            forecastResult[ratioName] = [...ratios[ratioName], ...forecastValues];
        }
        return forecastResult;
    },

    async getBenchmarkData(industry: string): Promise<CompanyData> {
        if (!this.ai) throw new Error("AI client is not initialized.");

        const ratioNames = Object.keys(this.getRatioCategories()).flatMap(cat => this.getRatioCategories()[cat]);
        const prompt = `You are an expert financial analyst. For the "${industry}" industry, provide typical benchmark values for the following financial ratios. The values should represent a healthy, average company in this sector.

Your response MUST be a single JSON object. The keys of the object are the ratio names, and the values are the corresponding benchmark numbers.
Do not include any explanatory text, comments, or markdown formatting. The response must be ONLY the raw JSON string.

The required ratio names are:
${ratioNames.join('\n')}

- For percentage-based ratios (e.g., margins, ROA, ROE, growth rates), provide the value as a decimal (e.g., 0.15 for 15%).
- For day-based ratios, provide the number of days.
- For other ratios, provide the direct value (e.g., 2.5 for a 2.5:1 current ratio).
- For growth ratios, provide a sensible annual growth rate.`;

        try {
            const response = await this.ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { responseMimeType: "application/json" },
            });

            const benchmarkValues = JSON.parse(response.text);

            const benchmarkRatios: RatioResult = { 'Year': ['Benchmark'] };
            for (const ratioName of ratioNames) {
                benchmarkRatios[ratioName] = [benchmarkValues[ratioName] ?? 0];
            }

            return {
                name: `${industry} Benchmark`,
                records: [],
                ratios: benchmarkRatios
            };
        } catch (e) {
            console.error("Error fetching benchmark data:", e);
            throw new Error(`Failed to fetch AI benchmark data for the ${industry} industry. Error: ${e.message}`);
        }
    },

    formatAIResponse(analysis: string, forPdf = false): string {
        const isArabic = this.currentLanguage === 'Arabic';
    
        // Keywords for matching.
        const summaryKeywords = isArabic
            ? ['ملخص الصحة المالية العام', 'ملخص تنفيذي']
            : ['Overall Financial Health Summary', 'Executive Summary'];
    
        const strengthKeywords = isArabic
            ? ['نقاط القوة', 'تحليل كل شركة']
            : ['Strengths', 'Company-by-Company Breakdown'];
    
        const improvementKeywords = isArabic
            ? ['مجالات التحسين']
            : ['Areas for Improvement'];
    
        const recommendationKeywords = isArabic
            ? ['التحليل المفصل والتوصيات', 'توصيات استراتيجية']
            : ['Detailed Analysis & Recommendations', 'Strategic Recommendations'];
    
        const conclusionKeywords = isArabic
            ? ['الخاتمة', 'الخلاصة']
            : ['Conclusion', 'Overall Winner/Conclusion'];
    
        const regexEscape = (str: string) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    
        // For the main web UI, we wrap the summary in a special highlight box.
        // This is skipped for PDF generation to ensure consistent structure.
        if (!forPdf) {
            const summaryRegex = new RegExp(`(### (?:${summaryKeywords.map(regexEscape).join('|')})[\\s\\S]*?)(?=\\n### |$)`, isArabic ? '' : 'i');
            analysis = analysis.replace(
                summaryRegex,
                (match) => {
                    const content = match.replace(/### (.*)/, `
                    <h3 class="summary-title">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
                        <span>$1</span>
                    </h3>`);
                    return `<div class="ai-summary-highlight">${content}</div>`;
                }
            );
        }
    
        // Replace all "###" headers with a consistent HTML structure.
        analysis = analysis.replace(/^### (.*)/gm, (match, title: string) => {
            const trimmedTitle = title.trim();
    
            // Check against keywords. Case-insensitive for English.
            const hasSummaryKeyword = summaryKeywords.some(kw => isArabic ? trimmedTitle.includes(kw) : new RegExp(`\\b${regexEscape(kw)}\\b`, 'i').test(trimmedTitle));
            if (hasSummaryKeyword) {
                // For PDFs, this ensures the summary has a standard header. For the web UI, this rule is ignored if the `!forPdf` block above ran.
                return `<div class="ai-section-header">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
                           <h3 class="ai-section-title">${title}</h3>
                        </div>`;
            }

            const hasStrengthKeyword = strengthKeywords.some(kw => isArabic ? trimmedTitle.includes(kw) : new RegExp(`\\b${regexEscape(kw)}\\b`, 'i').test(trimmedTitle));
            const hasConclusionKeyword = conclusionKeywords.some(kw => isArabic ? trimmedTitle.includes(kw) : new RegExp(`\\b${regexEscape(kw)}\\b`, 'i').test(trimmedTitle));
            if (hasStrengthKeyword || hasConclusionKeyword) {
                return `<div class="ai-section-header ai-section--strengths">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a2 2 0 0 1 1.79 1.11L15 5.88Z"/></svg>
                           <h3 class="ai-section-title">${title}</h3>
                        </div>`;
            }
    
            const hasImprovementKeyword = improvementKeywords.some(kw => isArabic ? trimmedTitle.includes(kw) : new RegExp(`\\b${regexEscape(kw)}\\b`, 'i').test(trimmedTitle));
            const hasRecommendationKeyword = recommendationKeywords.some(kw => isArabic ? trimmedTitle.includes(kw) : new RegExp(`\\b${regexEscape(kw)}\\b`, 'i').test(trimmedTitle));
            if (hasImprovementKeyword || hasRecommendationKeyword) {
                return `<div class="ai-section-header ai-section--improvement">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
                           <h3 class="ai-section-title">${title}</h3>
                        </div>`;
            }
            
            // Fallback for other sections
            return `<h3 class="content-subheader">${title}</h3>`;
        });
        
        // Standard markdown-to-html conversions
        return analysis
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^\*\s(.*)/gm, '<li>$1</li>')
            .replace(/(<\/li>)\s*<li>/g, '$1</li><li>')
            .replace(/((<li>.*<\/li>)+)/g, '<ul>$1</ul>')
            .replace(/\n/g, '<br>')
            .replace(/<br><ul>/g, '<ul>').replace(/<\/ul><br>/g, '</ul>')
            .replace(/<br><(div|h3|ul)/g, '<$1')
            .replace(/<\/(div|h3|ul)><br>/g, '</$1>')
            .replace(/<br><br>/g, '<br>');
    },

    displayAllResults(analyzedData: CompanyData[], aiAnalyses: AiAnalyses) {
        Object.keys(this.chartInstances).forEach(key => this.chartInstances[key].destroy());
        this.chartInstances = {};

        this.valuationNavLink.classList.toggle('hidden', !this.hasValuationData);

        if (analyzedData.length === 1) {
            this.forecastNavLink.classList.toggle('hidden', !this.forecastData);
            this.displaySingleCompanyView(analyzedData[0].ratios, aiAnalyses);
        } else {
            this.forecastNavLink.classList.add('hidden');
            this.displayMultiCompanyView(analyzedData, aiAnalyses);
        }

        this.setupChatEventListeners();
    },

    displaySingleCompanyView(ratios: RatioResult, aiAnalyses: AiAnalyses) {
        this.comparisonControls.classList.add('hidden');
        this.displaySummaryTab(ratios, aiAnalyses);
        
        if (this.forecastData) {
            this.displayForecastTab(this.forecastData);
        }
        
        const ratioCategories = this.getRatioCategories();
        for (const [category, ratioNames] of Object.entries(ratioCategories)) {
            const panelId = `${category.replace(/\s+/g, '_').toLowerCase()}-content`;
            const panel = document.getElementById(panelId);
            
            // Skip rendering valuation tab if no data
            if (category === 'Valuation' && !this.hasValuationData) continue;
            
            if (panel) this.displayCategoryTab(category, ratioNames, ratios, panel);
        }
        this.renderAiAnalysis();
    },

    displayMultiCompanyView(analyzedData: CompanyData[], aiAnalyses: AiAnalyses) {
        const nonBenchmarkData = analyzedData.filter(c => !c.name.includes('Benchmark'));
        const yearSets = nonBenchmarkData.map(c => new Set(c.ratios['Year']));
        let commonYears = yearSets.length > 0 ? [...yearSets[0]] : [];
        for (let i = 1; i < yearSets.length; i++) {
            commonYears = commonYears.filter(year => yearSets[i].has(year));
        }

        if (commonYears.length === 0 && nonBenchmarkData.length > 0) {
            this.showError("No common years found across the provided company files for comparison.");
            return;
        }

        const yearSelector = document.getElementById('year-selector') as HTMLSelectElement;
        yearSelector.innerHTML = commonYears.sort((a,b) => Number(b)-Number(a)).map(y => `<option value="${y}">${y}</option>`).join('');
        this.comparisonControls.classList.remove('hidden');

        const renderComparison = () => {
            const selectedYear = yearSelector.value;
            this.displayComparisonSummaryTab(aiAnalyses);
            const ratioCategories = this.getRatioCategories();
            for (const [category, ratioNames] of Object.entries(ratioCategories)) {
                const panelId = `${category.replace(/\s+/g, '_').toLowerCase()}-content`;
                const panel = document.getElementById(panelId);
                
                // Skip rendering valuation tab if no data
                if (category === 'Valuation' && !this.hasValuationData) continue;

                if (panel) this.displayComparisonCategoryTab(category, ratioNames, analyzedData, selectedYear, panel);
            }
            this.renderAiAnalysis();
        };

        yearSelector.removeEventListener('change', renderComparison); // Avoid duplicate listeners
        yearSelector.addEventListener('change', renderComparison);
        renderComparison();
    },

    getRatioCategories() {
        return {
            'Profitability': ['Gross Profit Margin', 'Operating Margin', 'EBITDA Margin', 'EBIT Margin', 'Net Profit Margin', 'Return on Assets (ROA)', 'Return on Equity (ROE)'],
            'Utilization': ['Asset Turnover', 'Fixed Asset Turnover', 'Inventory Days', 'A/R Days', 'A/P Days', 'Cash Days', 'Cash Conversion Cycle'],
            'Liquidity': ['Current Ratio', 'Quick Ratio'],
            'Leverage': ['Debt-to-Equity', 'Debt-to-Asset', 'Interest Coverage', 'Debt To EBITDA', 'Net Debt to EBITDA'],
            'Growth': ['Revenue Growth', 'Net Income Growth', 'EBITDA Growth', 'Total Asset Growth'],
            'Cash Flow': ['Free Cash Flow (FCF)', 'Operating Cash Flow to Sales', 'Cash Flow Coverage Ratio'],
            'Valuation': ['Price-to-Earnings (P/E)', 'Price-to-Sales (P/S)', 'Dividend Yield']
        };
    },

    displaySummaryTab(ratios: RatioResult, aiAnalyses: AiAnalyses) {
        const panel = document.getElementById('summary-content');
        if (!panel) return;
        panel.innerHTML = `
            <section class="card-glass p-6">
                <h2 class="content-header">Key Financial Ratios</h2>
                <div class="overflow-x-auto"><table class="w-full"><thead><tr id="summary-table-header"></tr></thead><tbody id="summary-table-body"></tbody></table></div>
            </section>
            <section class="card-glass p-6">
                 <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                    <h2 class="content-header !mb-0"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>AI-Powered Advisory</h2>
                    <div class="flex items-center gap-4">
                        <button id="export-pdf-btn" class="btn-outline" title="Download Full Report as PDF">
                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span>Download Report</span>
                        </button>
                        <div id="ai-lang-toggle" class="lang-toggle-container">
                            <button class="lang-toggle-btn active" data-lang="English">English</button>
                            <button class="lang-toggle-btn" data-lang="Arabic">العربية</button>
                        </div>
                    </div>
                </div>
                <div id="ai-analysis-content-container"></div>
            </section>
        `;

        const header = panel.querySelector('#summary-table-header');
        const body = panel.querySelector('#summary-table-body') as HTMLTableSectionElement;
        if (!header || !body) return;

        const periods = ratios['Year'] as string[];
        header.innerHTML = `<th>Ratio</th>` + periods.map(p => `<th class="text-right">${p}</th>`).join('');
        for (const ratioName in ratios) {
            if (ratioName === 'Year') continue;
            const row = body.insertRow();
            row.className = 'hover:bg-gray-700/50';
            row.innerHTML = `<td class="font-medium text-white">${ratioName}</td>` + ratios[ratioName].map(val => `<td class="text-right">${this.formatRatioValue(val, ratioName)}</td>`).join('');
        }
        
        this.aiAnalyses = aiAnalyses;
        this.currentLanguage = 'English';
        
        this.setupSummaryEventListeners(panel);
    },

    displayCategoryTab(category: string, ratioNames: string[], ratios: RatioResult, panel: HTMLElement) {
        const categoryId = category.replace(/\s+/g, '_').toLowerCase();
        panel.innerHTML = `
            <div class="smart-summary card-glass">
                 <div class="flex justify-between items-center">
                    <h3 class="smart-summary-title !mb-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                        <span>Smart Summary</span>
                    </h3>
                    <div class="lang-toggle-container">
                        <button class="lang-toggle-btn" data-lang="English">English</button>
                        <button class="lang-toggle-btn" data-lang="Arabic">العربية</button>
                    </div>
                </div>
                <div class="smart-summary-content mt-2"></div>
            </div>
            <h2 class="content-header">${category} Analysis</h2>`;

        const toggleContainer = panel.querySelector('.lang-toggle-container');
        if (toggleContainer) {
            toggleContainer.addEventListener('click', (e) => {
                const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.lang-toggle-btn');
                if (btn && btn.dataset.lang !== this.currentLanguage) {
                    this.currentLanguage = btn.dataset.lang as 'English' | 'Arabic';
                    this.renderAiAnalysis();
                }
            });
        }
            
        const tableContainer = document.createElement('div');
        tableContainer.className = 'overflow-x-auto mb-8';
        const tableId = `${categoryId}-table`;
        tableContainer.innerHTML = `<table class="w-full table-interactive" id="${tableId}"><thead></thead><tbody></tbody></table>`;
        panel.appendChild(tableContainer);

        const thead = tableContainer.querySelector('thead');
        const tbody = tableContainer.querySelector('tbody');
        if (!thead || !tbody) return;

        const periods = ratios['Year'] as string[];
        thead.innerHTML = `<tr><th>Ratio</th>${periods.map((p, i) => `<th class="text-right" data-period-index="${i}">${p}</th>`).join('')}</tr>`;
        for (const ratioName of ratioNames) {
            if (!ratios[ratioName]) continue;
            const row = tbody.insertRow();
            row.className = 'hover:bg-gray-700/50';
            row.dataset.ratioName = ratioName;
            let rowHTML = `<td class="font-medium">${ratioName}</td>`;
            rowHTML += (ratios[ratioName] as number[]).map((val, i) => `<td class="text-right" data-period-index="${i}">${this.formatRatioValue(val, ratioName)}</td>`).join('');
            row.innerHTML = rowHTML;
        }

        const canvasContainer = document.createElement('div');
        canvasContainer.style.height = '400px';
        const canvas = document.createElement('canvas');
        canvasContainer.appendChild(canvas);
        panel.appendChild(canvasContainer);

        const datasets = ratioNames.filter(name => ratios[name]).map((ratioName, index) => ({
            label: ratioName,
            data: ratios[ratioName].map(v => typeof v === 'number' && this.isPercentageRatio(ratioName) ? v * 100 : v),
            borderColor: this.chartColors[index % this.chartColors.length],
            backgroundColor: (context) => {
                const chart = context.chart;
                const {ctx, chartArea} = chart;
                if (!chartArea) return null;
                const color = this.chartColors[index % this.chartColors.length];
                const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                gradient.addColorStop(0, `${color}00`);
                gradient.addColorStop(1, `${color}66`);
                return gradient;
            },
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: this.chartColors[index % this.chartColors.length],
            pointRadius: 3,
            pointHoverRadius: 6,
        }));
        
        const labels = periods;

        if (this.chartInstances[categoryId]) this.chartInstances[categoryId].destroy();
        this.chartInstances[categoryId] = new Chart(canvas, {
            type: 'line', data: { labels, datasets }, options: this.getChartOptions(category, true, ratioNames, tableId)
        });
    },

    displayForecastTab(forecastData: RatioResult) {
        const panel = document.getElementById('forecast-content');
        if (!panel) return;
        if (this.chartInstances['forecast']) this.chartInstances['forecast'].destroy();

        const historicalPeriods = (this.analyzedData[0]?.ratios['Year'] || []).length;
    
        panel.innerHTML = `
            <h2 class="content-header">Financial Forecast</h2>
            <div class="forecast-controls">
                <label for="forecast-periods">Forecast Periods (1-10 years):</label>
                <input type="number" id="forecast-periods-input" min="1" max="10" value="3" class="w-20">
                <button id="update-forecast-btn" class="btn-secondary">Update Forecast</button>
            </div>
            <div class="smart-summary card-glass">
                <div class="flex justify-between items-center">
                    <h3 class="smart-summary-title !mb-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                        <span>AI Forecast Analysis</span>
                    </h3>
                    <div class="lang-toggle-container">
                        <button class="lang-toggle-btn" data-lang="English">English</button>
                        <button class="lang-toggle-btn" data-lang="Arabic">العربية</button>
                    </div>
                </div>
                <div id="forecast-ai-analysis-container" class="smart-summary-content mt-2"></div>
            </div>
            <div class="overflow-x-auto mb-8">
                <table class="w-full" id="forecast-table"></table>
            </div>
            <div style="height: 400px;">
                <canvas id="forecast-chart"></canvas>
            </div>
        `;
    
        const periodsInput = panel.querySelector('#forecast-periods-input') as HTMLInputElement;
        const updateBtn = panel.querySelector('#update-forecast-btn') as HTMLButtonElement;
    
        const reRenderForecast = () => {
            const periods = parseInt(periodsInput.value, 10);
            if (periods > 0 && periods <= 10) {
                this.forecastData = this.calculateForecasts(this.analyzedData[0].ratios, periods);
                this.displayForecastTab(this.forecastData);
                this.renderAiAnalysis(); // Re-render AI analysis in case language was changed
            }
        };
    
        updateBtn.addEventListener('click', reRenderForecast);
        
        panel.querySelector('.lang-toggle-container')?.addEventListener('click', (e) => {
            const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.lang-toggle-btn');
            if (btn && btn.dataset.lang !== this.currentLanguage) {
                this.currentLanguage = btn.dataset.lang as 'English' | 'Arabic';
                this.renderAiAnalysis();
            }
        });

        // Populate table
        const table = panel.querySelector('#forecast-table') as HTMLTableElement;
        const ratioNames = Object.keys(forecastData).filter(k => k !== 'Year' && !k.includes('Growth'));
        let tableHTML = '<thead><tr><th>Ratio</th>';
        forecastData['Year'].forEach((year, i) => {
            tableHTML += `<th class="text-right ${i >= historicalPeriods ? 'forecasted' : ''}">${year}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';
        ratioNames.forEach(rName => {
            tableHTML += `<tr class="hover:bg-gray-700/50">
                            <td class="font-medium text-white">${rName}</td>
                            ${(forecastData[rName] as (number|string)[]).map((val, i) =>
                                `<td class="text-right ${i >= historicalPeriods ? 'forecasted' : ''}">${this.formatRatioValue(val, rName)}</td>`
                            ).join('')}
                        </tr>`;
        });
        tableHTML += '</tbody>';
        table.innerHTML = tableHTML;
    
        // Populate chart
        const canvas = panel.querySelector('#forecast-chart') as HTMLCanvasElement;
        const datasets = ratioNames.filter(name => name.includes('Margin') || name.includes('ROA') || name.includes('ROE')).map((ratioName, index) => ({
            label: ratioName,
            data: forecastData[ratioName].map(v => typeof v === 'number' && this.isPercentageRatio(ratioName) ? v * 100 : v),
            borderColor: this.chartColors[index % this.chartColors.length],
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointBackgroundColor: this.chartColors[index % this.chartColors.length],
            pointRadius: 3,
            pointHoverRadius: 6,
            segment: {
                borderDash: (ctx) => (ctx.p1DataIndex >= historicalPeriods -1 ? [6, 6] : undefined),
            }
        }));
    
        this.chartInstances['forecast'] = new Chart(canvas, {
            type: 'line',
            data: { labels: forecastData.Year, datasets },
            options: this.getChartOptions('Forecast', true, ratioNames)
        });
    },

    displayComparisonSummaryTab(aiAnalyses: AiAnalyses) {
        const panel = document.getElementById('summary-content');
        if (!panel) return;
        panel.innerHTML = `
            <section class="card-glass p-6">
                 <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                    <h2 class="content-header !mb-0"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>AI-Powered Comparative Analysis</h2>
                    <div class="flex items-center gap-4">
                        <button id="export-pdf-btn" class="btn-outline" title="Download Full Report as PDF">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span>Download Report</span>
                        </button>
                        <div id="ai-lang-toggle" class="lang-toggle-container">
                            <button class="lang-toggle-btn active" data-lang="English">English</button>
                            <button class="lang-toggle-btn" data-lang="Arabic">العربية</button>
                        </div>
                    </div>
                </div>
                <div id="ai-analysis-content-container"></div>
            </section>
        `;
        
        this.aiAnalyses = aiAnalyses;
        this.currentLanguage = 'English';
        this.setupSummaryEventListeners(panel);
    },

    setupSummaryEventListeners(panel: HTMLElement) {
        panel.querySelector('#export-pdf-btn')?.addEventListener('click', this.handleExportPdf.bind(this));
        
        const toggleContainer = panel.querySelector('#ai-lang-toggle');
        if (toggleContainer) {
            toggleContainer.addEventListener('click', (e) => {
                const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.lang-toggle-btn');
                if (btn && btn.dataset.lang !== this.currentLanguage) {
                    this.currentLanguage = btn.dataset.lang as 'English' | 'Arabic';
                    this.renderAiAnalysis();
                }
            });
        }
    },
    
    setupChatEventListeners() {
        this.chatSection = document.getElementById('chat-section') as HTMLDivElement;
        if (!this.chatSection || !this.chat) return;

        this.chatHistoryContainer = document.getElementById('chat-history-container') as HTMLDivElement;
        this.chatLoader = document.getElementById('chat-loader') as HTMLDivElement;
        this.chatForm = document.getElementById('chat-form') as HTMLFormElement;
        this.chatInput = document.getElementById('chat-input') as HTMLInputElement;
        this.chatSendBtn = document.getElementById('chat-send-btn') as HTMLButtonElement;
        
        if (this.chatForm) {
            // Use a bound function to ensure `this` context and allow for proper removal
            if (!this.boundChatSubmit) {
                this.boundChatSubmit = this.handleChatSubmit.bind(this);
            }
            this.chatForm.removeEventListener('submit', this.boundChatSubmit); // Prevent duplicates
            this.chatForm.addEventListener('submit', this.boundChatSubmit);
        }

        this.chatSection.classList.remove('hidden');
        this.renderChatHistory();
    },

    renderAiAnalysis() {
        if (!this.aiAnalyses) return;

        const langKey = this.currentLanguage.toLowerCase() as 'english' | 'arabic';
        const analysisContent = this.aiAnalyses[langKey];
    
        // 1. Update main AI advisory panel
        const mainAiContainer = document.querySelector('#ai-analysis-content-container');
        if (mainAiContainer) {
            mainAiContainer.innerHTML = this.formatAIResponse(analysisContent.main);
            if (this.currentLanguage === 'Arabic') {
                mainAiContainer.setAttribute('dir', 'rtl');
                mainAiContainer.classList.add('lang-ar');
            } else {
                mainAiContainer.removeAttribute('dir');
                mainAiContainer.classList.remove('lang-ar');
            }
        }
    
        // 2. Update all category smart summaries
        const categoriesAndForecast = {...this.getRatioCategories(), 'Forecast': []};
        Object.keys(categoriesAndForecast).forEach(category => {
            const categoryKey = category.replace(/\s+/g, '_').toLowerCase() as keyof AiAnalysisSummaries;
            
            // Special handling for forecast panel
            const isForecast = categoryKey === 'forecast';
            const panelId = isForecast ? 'forecast-content' : `${categoryKey}-content`;
            const summaryContainerSelector = isForecast ? '#forecast-ai-analysis-container' : `#${panelId} .smart-summary-content`;

            const summaryContainer = document.querySelector(summaryContainerSelector);
            const summaryPanel = summaryContainer?.closest(isForecast ? '.card-glass' : '.smart-summary');

            if (summaryContainer && summaryPanel && analysisContent.summaries[categoryKey]) {
                summaryContainer.innerHTML = this.formatAIResponse(analysisContent.summaries[categoryKey]);
                 if (this.currentLanguage === 'Arabic') {
                    summaryPanel.setAttribute('dir', 'rtl');
                    summaryPanel.classList.add('lang-ar');
                } else {
                    summaryPanel.removeAttribute('dir');
                    summaryPanel.classList.remove('lang-ar');
                }
            }
        });
    
        // 3. Update language toggle button states
        const toggleButtons = document.querySelectorAll('.lang-toggle-btn');
        toggleButtons.forEach(btn => {
            const button = btn as HTMLButtonElement;
            button.classList.toggle('active', button.dataset.lang === this.currentLanguage);
        });
    },

    displayComparisonCategoryTab(category: string, ratioNames: string[], analyzedData: CompanyData[], year: string, panel: HTMLElement) {
        const categoryId = category.replace(/\s+/g, '_').toLowerCase();
        panel.innerHTML = `
            <div class="smart-summary card-glass">
                <div class="flex justify-between items-center">
                    <h3 class="smart-summary-title !mb-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                        <span>Smart Summary</span>
                    </h3>
                     <div class="lang-toggle-container">
                        <button class="lang-toggle-btn" data-lang="English">English</button>
                        <button class="lang-toggle-btn" data-lang="Arabic">العربية</button>
                    </div>
                </div>
                <div class="smart-summary-content mt-2"></div>
            </div>
            <h2 class="content-header">${category} Comparison (${year})</h2>
        `;

        const toggleContainer = panel.querySelector('.lang-toggle-container');
        if (toggleContainer) {
            toggleContainer.addEventListener('click', (e) => {
                const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.lang-toggle-btn');
                if (btn && btn.dataset.lang !== this.currentLanguage) {
                    this.currentLanguage = btn.dataset.lang as 'English' | 'Arabic';
                    this.renderAiAnalysis();
                }
            });
        }

        const tableContainer = document.createElement('div');
        tableContainer.className = 'overflow-x-auto mb-8';
        panel.appendChild(tableContainer);

        const tableId = `${categoryId}-table`;
        let tableHTML = `<table class="w-full table-interactive" id="${tableId}"><thead><tr><th>Ratio</th>`;
        analyzedData.forEach((c, i) => tableHTML += `<th class="text-right" data-company-index="${i}">${c.name}</th>`);
        tableHTML += `</tr></thead><tbody>`;

        ratioNames.forEach(rName => {
            tableHTML += `<tr class="hover:bg-gray-700/50" data-ratio-name="${rName}"><td class="font-medium">${rName}</td>`;
            analyzedData.forEach((c, i) => {
                const yearIndex = c.name.includes('Benchmark') ? 0 : c.ratios['Year'].indexOf(year);
                const value = yearIndex !== -1 ? c.ratios[rName]?.[yearIndex] : 'N/A';
                tableHTML += `<td class="text-right" data-company-index="${i}">${this.formatRatioValue(value, rName)}</td>`;
            });
            tableHTML += `</tr>`;
        });
        tableHTML += `</tbody></table>`;
        tableContainer.innerHTML = tableHTML;

        const canvasContainer = document.createElement('div');
        canvasContainer.style.height = '400px';
        const canvas = document.createElement('canvas');
        canvasContainer.appendChild(canvas);
        panel.appendChild(canvasContainer);

        const datasets = analyzedData.map((company, index) => {
            const data = ratioNames.map(rName => {
                const yearIndex = company.name.includes('Benchmark') ? 0 : company.ratios['Year'].indexOf(year);
                let value = (yearIndex !== -1 ? company.ratios[rName]?.[yearIndex] : NaN) as number;
                if (this.isPercentageRatio(rName)) value *= 100;
                return value;
            });
            return {
                label: company.name,
                data: data,
                backgroundColor: `${this.chartColors[index % this.chartColors.length]}B3`,
                borderColor: this.chartColors[index % this.chartColors.length],
                borderWidth: 2,
                borderRadius: 4,
            };
        });
        
        if (this.chartInstances[categoryId]) this.chartInstances[categoryId].destroy();
        this.chartInstances[categoryId] = new Chart(canvas, {
            type: 'bar', data: { labels: ratioNames, datasets }, options: this.getChartOptions(category, false, ratioNames, tableId)
        });
    },

    getChartOptions(category: string, isLineChart: boolean, ratioNames: string[] = [], tableId: string | null = null) {
        const anyPercentInChart = (ratioNames || []).some(label => this.isPercentageRatio(String(label)));
        return {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (e: MouseEvent, elements: any[], chart: ChartInstance) => {
                if (!tableId || !elements.length) return;
    
                const table = document.getElementById(tableId);
                if (!table) return;
    
                // Clear previous highlights
                table.querySelectorAll('.highlighted').forEach(el => el.classList.remove('highlighted'));
                
                const firstEl = elements[0];
                
                if (isLineChart) {
                    // Single company view, line chart. Clicked point gives period index and ratio name.
                    const periodIndex = firstEl.index;
                    const ratioName = chart.data.datasets[firstEl.datasetIndex].label;
    
                    if (ratioName) {
                        const row = table.querySelector(`tr[data-ratio-name="${CSS.escape(ratioName)}"]`);
                        row?.classList.add('highlighted');
                    }
                    
                    const columnCells = table.querySelectorAll(`[data-period-index="${periodIndex}"]`);
                    columnCells.forEach(cell => cell.classList.add('highlighted'));
    
                } else { // Bar chart for multi-company comparison
                    // Clicked bar gives ratio name and company index.
                    const ratioIndex = firstEl.index;
                    const companyIndex = firstEl.datasetIndex;
    
                    const ratioName = chart.data.labels[ratioIndex] as string;
                    
                    if (ratioName) {
                        const row = table.querySelector(`tr[data-ratio-name="${CSS.escape(ratioName)}"]`);
                        row?.classList.add('highlighted');
                    }
    
                    const columnCells = table.querySelectorAll(`[data-company-index="${companyIndex}"]`);
                    columnCells.forEach(cell => cell.classList.add('highlighted'));
                }
            },
            plugins: {
                title: { display: true, text: `${category} ${isLineChart ? 'Trends' : 'Comparison'}`, color: '#e5e7eb', font: { size: 16 } },
                legend: { position: 'bottom' as const, labels: { color: '#d1d5db', usePointStyle: true, pointStyle: 'rectRounded' } },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    borderColor: 'rgba(0, 229, 255, 0.2)',
                    borderWidth: 1,
                    titleColor: '#e2e8f0',
                    bodyColor: '#94a3b8',
                    padding: 12,
                    cornerRadius: 8,
                    usePointStyle: true,
                    callbacks: {
                        label: (context) => {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            const rawValue = isLineChart ? context.parsed.y : (context.raw as number);
                            if (rawValue !== null) {
                                const ratioName = isLineChart ? context.dataset.label : context.label;
                                label += this.formatRatioValue(rawValue / (this.isPercentageRatio(ratioName) ? 100 : 1), ratioName);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        color: '#9ca3af',
                        callback: (value) => {
                           return typeof value === 'number' ? value.toFixed(0) + (anyPercentInChart ? '%' : '') : value;
                        }
                    },
                    grid: { color: 'rgba(0, 229, 255, 0.1)' }
                },
                x: { 
                    ticks: { color: '#9ca3af' }, 
                    grid: { display: false }
                }
            },
            animation: {
                duration: 1000
            }
        };
    },

    isPercentageRatio(ratioName: string): boolean {
        return ratioName.includes('Margin') || ratioName.includes('Return') || ratioName.includes('Growth') || ratioName.includes('Yield');
    },

    formatRatioValue(val: any, ratioName: string): string {
        if (typeof val !== 'number' || isNaN(val)) return 'N/A';
        if (this.isPercentageRatio(ratioName)) return `${(val * 100).toFixed(2)}%`;
        if (ratioName.toLowerCase().includes('days') || ratioName.toLowerCase().includes('cycle')) return val.toFixed(1);
        return val.toFixed(2);
    },

    parseFullAIResponse(responseText: string): AiAnalysisContent {
        const getSection = (key: string) => {
            const match = responseText.match(new RegExp(`\\[${key}_START\\]([\\s\\S]*?)\\[${key}_END\\]`, 'i'));
            return match ? match[1].trim() : '';
        };
    
        const main = getSection('MAIN_ANALYSIS');
        const summaries: AiAnalysisSummaries = {
            profitability: getSection('PROFITABILITY_SUMMARY'),
            utilization: getSection('UTILIZATION_SUMMARY'),
            liquidity: getSection('LIQUIDITY_SUMMARY'),
            leverage: getSection('LEVERAGE_SUMMARY'),
            growth: getSection('GROWTH_SUMMARY'),
            cash_flow: getSection('CASH_FLOW_SUMMARY'),
            valuation: getSection('VALUATION_SUMMARY'),
            forecast: getSection('FORECAST_ANALYSIS'),
        };
        
        const fallbackSummaries: AiAnalysisSummaries = {
            profitability: "Summary not available.",
            utilization: "Summary not available.",
            liquidity: "Summary not available.",
            leverage: "Summary not available.",
            growth: "Summary not available.",
            cash_flow: "Summary not available.",
            valuation: "Summary not available.",
            forecast: "Forecast analysis not available.",
        };
    
        if (!main && Object.values(summaries).every(s => !s)) {
            return {
                main: responseText || "AI analysis could not be parsed or was empty.",
                summaries: fallbackSummaries
            };
        }
        
        for (const key in summaries) {
            if (!summaries[key as keyof AiAnalysisSummaries]) {
                summaries[key as keyof AiAnalysisSummaries] = fallbackSummaries[key as keyof AiAnalysisSummaries];
            }
        }
    
        return { main, summaries };
    },

    async getAIAnalysis(analyzedData: CompanyData[], forecastData: RatioResult | null = null): Promise<AiAnalyses> {
        if (!this.ai) throw new Error("AI client is not initialized.");
    
        const generateAnalysisForLanguage = async (language: 'English' | 'Arabic'): Promise<AiAnalysisContent> => {
            const dataString = JSON.stringify(
                analyzedData.length === 1
                    ? analyzedData[0].ratios
                    : analyzedData.reduce((acc, company) => {
                        acc[company.name] = company.ratios;
                        return acc;
                    }, {}),
                (key, value) => (typeof value === 'number' && !isNaN(value)) ? parseFloat(value.toFixed(4)) : value,
                2
            );
            
            const langKey = language.toLowerCase() as 'english' | 'arabic';
            
            const prompts = {
                english: {
                    single: `You are an expert financial analyst. Your task is to perform a comprehensive analysis of a company's financial ratios and provide actionable advice.
Your response MUST be in English and MUST follow this exact structure using the provided markers. Do not include any text outside these markers.

[MAIN_ANALYSIS_START]
(Provide a comprehensive analysis in Markdown here, including:
1.  **Overall Financial Health Summary:** A brief, high-level summary.
2.  **Strengths:** 2-3 key financial strengths.
3.  **Areas for Improvement:** 2-3 significant weaknesses.
4.  **Detailed Analysis & Recommendations:** For each weakness, explain the problem and give actionable recommendations.
5.  **Conclusion:** A forward-looking statement.)
[MAIN_ANALYSIS_END]

---

**Mandatory Smart Summaries:** You MUST provide a concise, 1-2 sentence summary for EACH category below.

[PROFITABILITY_SUMMARY_START]
(1-2 sentence summary of Profitability ratios)
[PROFITABILITY_SUMMARY_END]

[UTILIZATION_SUMMARY_START]
(1-2 sentence summary of Utilization ratios)
[UTILIZATION_SUMMARY_END]

[LIQUIDITY_SUMMARY_START]
(1-2 sentence summary of Liquidity ratios)
[LIQUIDITY_SUMMARY_END]

[LEVERAGE_SUMMARY_START]
(1-2 sentence summary of Leverage ratios)
[LEVERAGE_SUMMARY_END]

[GROWTH_SUMMARY_START]
(1-2 sentence summary of Growth ratios)
[GROWTH_SUMMARY_END]

[CASH_FLOW_SUMMARY_START]
(1-2 sentence summary of Cash Flow ratios)
[CASH_FLOW_SUMMARY_END]

[VALUATION_SUMMARY_START]
(1-2 sentence summary of Valuation ratios. If not applicable, state "Valuation data not provided.")
[VALUATION_SUMMARY_END]

[FORECAST_ANALYSIS_START]
(If forecast data is present, summarize the company's expected trajectory and potential risks. Acknowledge this is a simple linear forecast. If not applicable, state "No forecast data provided.")
[FORECAST_ANALYSIS_END]
`,
                    multi: `You are an expert financial analyst specializing in competitive analysis. Your task is to perform a comprehensive comparative analysis of financial ratios for multiple companies. If one company is a benchmark, frame the analysis as comparing the other company to its industry standard.
Your response MUST be in English and MUST follow this exact structure using the provided markers. Do not include any text outside these markers.

[MAIN_ANALYSIS_START]
(Provide a comprehensive comparative analysis in Markdown here, including:
1.  **Executive Summary:** High-level comparison of the companies' financial health.
2.  **Company-by-Company Breakdown:** Briefly summarize strengths and weaknesses for each company relative to its peers.
3.  **Ratio Category Comparison:** Compare companies across key categories (Profitability, Leverage, etc.), highlighting performers and laggards.
4.  **Strategic Recommendations:** Provide actionable recommendations for each company.
5.  **Overall Winner/Conclusion:** State which company is in the strongest position and why.)
[MAIN_ANALYSIS_END]

---

**Mandatory Smart Summaries:** You MUST provide a concise, 1-2 sentence comparative summary for EACH category below.

[PROFITABILITY_SUMMARY_START]
(1-2 sentence comparison of Profitability ratios)
[PROFITABILITY_SUMMARY_END]

[UTILIZATION_SUMMARY_START]
(1-2 sentence comparison of Utilization ratios)
[UTILIZATION_SUMMARY_END]

[LIQUIDITY_SUMMARY_START]
(1-2 sentence comparison of Liquidity ratios)
[LIQUIDITY_SUMMARY_END]

[LEVERAGE_SUMMARY_START]
(1-2 sentence comparison of Leverage ratios)
[LEVERAGE_SUMMARY_END]

[GROWTH_SUMMARY_START]
(1-2 sentence comparison of Growth ratios)
[GROWTH_SUMMARY_END]

[CASH_FLOW_SUMMARY_START]
(1-2 sentence comparison of Cash Flow ratios)
[CASH_FLOW_SUMMARY_END]

[VALUATION_SUMMARY_START]
(1-2 sentence comparison of Valuation ratios. If not applicable, state "Valuation data not provided.")
[VALUATION_SUMMARY_END]

[FORECAST_ANALYSIS_START]
(This section is for single-company analysis only. State "Not applicable for comparison.")
[FORECAST_ANALYSIS_END]
`
                },
                arabic: {
                    single: `أنت محلل مالي خبير. مهمتك هي إجراء تحليل شامل للنسب المالية للشركة وتقديم نصائح قابلة للتنفيذ.
يجب أن يكون ردك باللغة العربية ويجب أن يتبع هذا الهيكل الدقيق باستخدام العلامات المتوفرة. لا تدرج أي نص خارج هذه العلامات.

[MAIN_ANALYSIS_START]
(قدم تحليلًا شاملاً بصيغة Markdown هنا، شاملاً:
1.  **ملخص الصحة المالية العام:** ملخص موجز وعالي المستوى.
2.  **نقاط القوة:** 2-3 من نقاط القوة المالية الرئيسية.
3.  **مجالات التحسين:** 2-3 من نقاط الضعف الكبيرة.
4.  **التحليل المفصل والتوصيات:** لكل نقطة ضعف، اشرح المشكلة وقدم توصيات قابلة للتنفيذ.
5.  **الخاتمة:** بيان تطلعي.)
[MAIN_ANALYSIS_END]

---

**ملخصات ذكية إلزامية:** يجب عليك تقديم ملخص موجز من جملة إلى جملتين لكل فئة أدناه.

[PROFITABILITY_SUMMARY_START]
(ملخص من 1-2 جملة لنسب الربحية)
[PROFITABILITY_SUMMARY_END]

[UTILIZATION_SUMMARY_START]
(ملخص من 1-2 جملة لنسب كفاءة التشغيل)
[UTILIZATION_SUMMARY_END]

[LIQUIDITY_SUMMARY_START]
(ملخص من 1-2 جملة لنسب السيولة)
[LIQUIDITY_SUMMARY_END]

[LEVERAGE_SUMMARY_START]
(ملخص من 1-2 جملة لنسب الرفع المالي)
[LEVERAGE_SUMMARY_END]

[GROWTH_SUMMARY_START]
(ملخص من 1-2 جملة لنسب النمو)
[GROWTH_SUMMARY_END]

[CASH_FLOW_SUMMARY_START]
(ملخص من 1-2 جملة لنسب التدفق النقدي)
[CASH_FLOW_SUMMARY_END]

[VALUATION_SUMMARY_START]
(ملخص من 1-2 جملة لنسب التقييم. إذا لم يكن ذلك ممكنًا، اذكر "بيانات التقييم غير متوفرة.")
[VALUATION_SUMMARY_END]

[FORECAST_ANALYSIS_START]
(إذا كانت بيانات التوقعات موجودة، لخص المسار المتوقع للشركة والمخاطر المحتملة. أقر بأن هذا توقع خطي بسيط. إذا لم يكن ذلك ممكنًا، اذكر "لا توجد بيانات توقعات متوفرة.")
[FORECAST_ANALYSIS_END]
`,
                    multi: `أنت محلل مالي خبير متخصص في التحليل التنافسي. مهمتك هي إجراء تحليل مقارن شامل للنسب المالية لعدة شركات. إذا كانت إحدى الشركات معيارًا صناعيًا، فقم بصياغة التحليل على أنه مقارنة الشركة الأخرى بمعيار صناعتها.
يجب أن يكون ردك باللغة العربية ويجب أن يتبع هذا الهيكل الدقيق باستخدام العلامات المتوفرة. لا تدرج أي نص خارج هذه العلامات.

[MAIN_ANALYSIS_START]
(قدم تحليلًا مقارنًا شاملاً بصيغة Markdown هنا، شاملاً:
1.  **ملخص تنفيذي:** مقارنة عالية المستوى للصحة المالية للشركات.
2.  **تحليل كل شركة:** لخص بإيجاز نقاط القوة والضعف لكل شركة مقارنة بأقرانها.
3.  **مقارنة فئات النسب:** قارن الشركات عبر الفئات الرئيسية (الربحية، الرفع المالي، إلخ)، مع تسليط الضوء على الأداء المتميز والمتأخر.
4.  **توصيات استراتيجية:** قدم توصيات قابلة للتنفيذ لكل شركة.
5.  **الخلاصة:** اذكر أي شركة تبدو في أقوى مركز ولماذا.)
[MAIN_ANALYSIS_END]

---

**ملخصات ذكية إلزامية:** يجب عليك تقديم ملخص مقارن موجز من جملة إلى جملتين لكل فئة أدناه.

[PROFITABILITY_SUMMARY_START]
(مقارنة من 1-2 جملة لنسب الربحية)
[PROFITABILITY_SUMMARY_END]

[UTILIZATION_SUMMARY_START]
(مقارنة من 1-2 جملة لنسب كفاءة التشغيل)
[UTILIZATION_SUMMARY_END]

[LIQUIDITY_SUMMARY_START]
(مقارنة من 1-2 جملة لنسب السيولة)
[LIQUIDITY_SUMMARY_END]

[LEVERAGE_SUMMARY_START]
(مقارنة من 1-2 جملة لنسب الرفع المالي)
[LEVERAGE_SUMMARY_END]

[GROWTH_SUMMARY_START]
(مقارنة من 1-2 جملة لنسب النمو)
[GROWTH_SUMMARY_END]

[CASH_FLOW_SUMMARY_START]
(مقارنة من 1-2 جملة لنسب التدفق النقدي)
[CASH_FLOW_SUMMARY_END]

[VALUATION_SUMMARY_START]
(مقارنة من 1-2 جملة لنسب التقييم. إذا لم يكن ذلك ممكنًا، اذكر "بيانات التقييم غير متوفرة.")
[VALUATION_SUMMARY_END]

[FORECAST_ANALYSIS_START]
(هذا القسم للتحليل الفردي فقط. اذكر "غير قابل للتطبيق في المقارنة.")
[FORECAST_ANALYSIS_END]
`
                }
            };
    
            const systemInstruction = analyzedData.length === 1 ? prompts[langKey].single : prompts[langKey].multi;
    
            let contents = `Here is the financial data:\n\`\`\`json\n${dataString}\n\`\`\``;
            if (forecastData) {
                const forecastString = JSON.stringify(forecastData,
                    (key, value) => (typeof value === 'number' && !isNaN(value)) ? parseFloat(value.toFixed(4)) : value,
                    2
                );
                contents += `\n\nHere is the forecasted data for the primary company:\n\`\`\`json\n${forecastString}\n\`\`\``;
            }
    
            const response = await this.ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: contents,
                config: {
                    systemInstruction: systemInstruction,
                },
            });
            return this.parseFullAIResponse(response.text);
        };
    
        try {
            const [englishResult, arabicResult] = await Promise.all([
                generateAnalysisForLanguage('English'),
                generateAnalysisForLanguage('Arabic'),
            ]);
    
            return {
                english: englishResult,
                arabic: arabicResult,
            };
        } catch (e) {
            console.error("Error during AI analysis:", e);
            const errorText = `The AI analysis failed. This can happen due to network issues or problems with the AI service. Please try again later. Details: ${e.message}`;
            const emptySummaries: AiAnalysisSummaries = {
                profitability: "Summary not available.",
                utilization: "Summary not available.",
                liquidity: "Summary not available.",
                leverage: "Summary not available.",
                growth: "Summary not available.",
                cash_flow: "Summary not available.",
                valuation: "Summary not available.",
                forecast: "Forecast analysis not available.",
            };
            return {
                english: { main: errorText, summaries: emptySummaries },
                arabic: { main: errorText, summaries: emptySummaries },
            };
        }
    },

    splitAiAnalysis(markdownText: string, language: 'English' | 'Arabic'): { [key: string]: string } {
        const isArabic = language === 'Arabic';
        const keywords = {
            summary: isArabic ? ['ملخص الصحة المالية العام', 'ملخص تنفيذي'] : ['Overall Financial Health Summary', 'Executive Summary'],
            strengths: isArabic ? ['نقاط القوة', 'تحليل كل شركة'] : ['Strengths', 'Company-by-Company Breakdown'],
            improvements: isArabic ? ['مجالات التحسين'] : ['Areas for Improvement'],
            recommendations: isArabic ? ['التحليل المفصل والتوصيات', 'توصيات استراتيجية'] : ['Detailed Analysis & Recommendations', 'Strategic Recommendations'],
            conclusion: isArabic ? ['الخاتمة', 'الخلاصة'] : ['Conclusion', 'Overall Winner/Conclusion'],
            cash_flow: isArabic ? ['التدفق النقدي'] : ['Cash Flow'],
            valuation: isArabic ? ['التقييم'] : ['Valuation', 'Valuation Ratios'],
        };
    
        const sections: { [key: string]: string } = {};
        let lastKey = 'summary'; // The default key for content before any known header
        sections[lastKey] = '';
    
        const chunks = markdownText.split(/\n(?=###\s)/);
    
        for (const chunk of chunks) {
            const titleMatch = chunk.match(/###\s(.*?)\n/);
            const title = titleMatch ? titleMatch[1].trim() : '';
            let foundKey: string | null = null;
    
            if (title) {
                for (const [key, kws] of Object.entries(keywords)) {
                    // Use a precise match for the title
                    if (kws.some(kw => isArabic ? title.includes(kw) : new RegExp(`^${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i').test(title))) {
                        foundKey = key;
                        break;
                    }
                }
            }
            
            if (foundKey) {
                lastKey = foundKey;
                if (!sections[lastKey]) {
                    sections[lastKey] = '';
                }
            }
            sections[lastKey] += (sections[lastKey] ? '\n' : '') + chunk;
        }
    
        return sections;
    },

    async handleExportPdf() {
        this.showLoader('Preparing PDF report...');

        const allPanels = document.querySelectorAll('.content-panel');
        const activePanel = document.querySelector('.content-panel:not(.hidden)');
        
        try {
            const { jsPDF } = jspdf;
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' }) as any;
            if (!this.analyzedData.length || !this.aiAnalyses) throw new Error("No data available.");
    
            const MARGIN = 15;
            const PAGE_WIDTH = doc.internal.pageSize.getWidth();
            const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
            const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
    
            // --- Helper Functions ---
            const addPageHeader = (docInstance: any) => {
                docInstance.setFont('helvetica', 'bold');
                docInstance.setFontSize(16);
                docInstance.setTextColor('#06b6d4');
                docInstance.text('AAA Finance', MARGIN, MARGIN);
                docInstance.setFont('helvetica', 'normal');
                docInstance.setFontSize(10);
                docInstance.setTextColor('#64748b'); // slate-500
                const reportTitle = this.analyzedData.length > 1 ? 'Comparative Analysis Report' : 'Financial Analysis Report';
                docInstance.text(reportTitle, PAGE_WIDTH - MARGIN, MARGIN, { align: 'right' });
                docInstance.setDrawColor('#cbd5e1'); // slate-300
                docInstance.setLineWidth(0.2);
                docInstance.line(MARGIN, MARGIN + 4, PAGE_WIDTH - MARGIN, MARGIN + 4);
            };
    
            const addPageFooter = (docInstance: any) => {
                const pageCount = docInstance.internal.getNumberOfPages();
                docInstance.setFontSize(8);
                docInstance.setTextColor('#94a3b8'); // slate-400
                for (let i = 1; i <= pageCount; i++) {
                    docInstance.setPage(i);
                    docInstance.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 10, { align: 'center' });
                    docInstance.text(`Generated on: ${new Date().toLocaleDateString()}`, MARGIN, PAGE_HEIGHT - 10);
                }
            };
            
            const addContentAsNativeText = async (docInstance, element, startY) => {
                if (!element) return startY;
            
                let currentY = startY;
                const LINE_HEIGHT = 5.5;
            
                const checkPageBreak = (neededHeight = LINE_HEIGHT) => {
                    if (currentY + neededHeight > PAGE_HEIGHT - MARGIN) {
                        docInstance.addPage();
                        addPageHeader(docInstance);
                        currentY = MARGIN + 15;
                    }
                };
            
                const tempDiv = element.cloneNode(true) as HTMLElement;
                const lang = tempDiv.closest('.lang-ar') ? 'ar' : 'en';

                // Simplified parsing using markers
                tempDiv.querySelectorAll('strong, b').forEach(el => {
                    el.prepend('[B]');
                    el.append('[/B]');
                });
                tempDiv.querySelectorAll('h3, .ai-section-title').forEach(el => el.prepend('[H3]'));
                tempDiv.querySelectorAll('li').forEach(el => el.prepend('[LI]'));
                
                // Convert block elements to newlines for splitting
                tempDiv.querySelectorAll('p, div, br, ul').forEach(el => el.append('\n'));
                
                const rawText = tempDiv.innerText;
                const lines = rawText.replace(/\n\s*\n/g, '\n').trim().split('\n');

                let isBold = false;
                for (let line of lines) {
                    if (!line.trim()) continue;

                    const isH3 = line.startsWith('[H3]');
                    const isLi = line.startsWith('[LI]');
                    line = line.replace('[H3]', '').replace('[LI]', '');
                    
                    const xPos = MARGIN + (isLi ? 5 : 0);
                    const availableWidth = CONTENT_WIDTH - (isLi ? 5 : 0);

                    if (isH3) {
                        docInstance.setFont('helvetica', 'bold');
                        docInstance.setFontSize(14); // Changed from 12
                        docInstance.setTextColor('#06b6d4');
                    } else {
                         docInstance.setFont('helvetica', 'normal');
                         docInstance.setFontSize(10);
                         docInstance.setTextColor('#1e293b'); // slate-800
                    }
                    
                    const textSegments = line.split(/(\[B\]|\[\/B\])/g).filter(Boolean);
                    let currentX = xPos;

                    const wrappedSegments = docInstance.splitTextToSize(line.replace(/\[B\]|\[\/B\]/g, ''), availableWidth);
                    checkPageBreak(wrappedSegments.length * LINE_HEIGHT);
                    
                    for(const segment of textSegments) {
                        if (segment === '[B]') { isBold = true; continue; }
                        if (segment === '[/B]') { isBold = false; continue; }
                        
                        docInstance.setFont('helvetica', isBold ? 'bold' : 'normal');
                    }

                    docInstance.setFont('helvetica', isH3 || line.includes('[B]') ? 'bold' : 'normal');
                    const cleanLine = line.replace(/\[B\]|\[\/B\]/g, '');
                    const wrappedLines = docInstance.splitTextToSize(cleanLine, availableWidth);
                    
                    docInstance.text(isLi ? '• ' + wrappedLines[0] : wrappedLines[0], xPos, currentY, { align: lang === 'ar' ? 'right' : 'left', lang });
                    if(wrappedLines.length > 1) {
                        docInstance.text(wrappedLines.slice(1), xPos + (isLi ? 2 : 0), currentY + LINE_HEIGHT, { align: lang === 'ar' ? 'right' : 'left', lang });
                    }
                    currentY += wrappedLines.length * LINE_HEIGHT;
                    
                    if(isH3) currentY += 4; // Changed from 3
                }
                
                return currentY;
            };
    
            // --- Page 1: Title Page ---
            this.showLoader('Generating cover page...');
            doc.setFillColor('#ffffff');
            doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(32);
            doc.setTextColor('#0f172a'); // slate-900
            doc.text('AAA Finance', PAGE_WIDTH / 2, 80, { align: 'center' });
            doc.setFontSize(18);
            doc.setTextColor('#06b6d4');
            const reportTitle = this.analyzedData.length > 1 ? 'Comparative Financial Analysis' : 'Financial Health Report';
            doc.text(reportTitle, PAGE_WIDTH / 2, 100, { align: 'center' });
            doc.setFontSize(22);
            doc.setTextColor('#1e293b');
            const companyNames = this.analyzedData.map(c => c.name).join(' vs. ');
            doc.text(companyNames, PAGE_WIDTH / 2, 130, { align: 'center' });
            doc.setFontSize(10);
            doc.setTextColor('#64748b'); // slate-500
            doc.text(`Report Date: ${new Date().toLocaleDateString()}`, PAGE_WIDTH / 2, 140, { align: 'center' });
    
            // --- Subsequent Pages: Category Breakdowns ---
            const ratioCategories = this.getRatioCategories();
            for (const [category, ratioNames] of Object.entries(ratioCategories)) {
                if(category === 'Valuation' && !this.hasValuationData) continue;

                const categoryId = category.replace(/\s+/g, '_').toLowerCase();
                const panel = document.getElementById(`${categoryId}-content`);
                const chartInstance = this.chartInstances[categoryId];
                if (!panel || !chartInstance) continue;

                this.showLoader(`Adding ${category} section...`);
    
                doc.addPage();
                addPageHeader(doc);
                let currentY = MARGIN + 15;
    
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.setTextColor('#0f172a');
                doc.text(`${category} Analysis`, MARGIN, currentY);
                currentY += 10;
    
                // Add smart summary content
                const langKey = this.currentLanguage.toLowerCase() as 'english' | 'arabic';
                const categoryKey = category.replace(/\s+/g, '_').toLowerCase() as keyof AiAnalysisSummaries;
                if (this.aiAnalyses[langKey] && this.aiAnalyses[langKey].summaries[categoryKey]) {
                    const summaryTextRaw = this.aiAnalyses[langKey].summaries[categoryKey];
                    const summaryText = summaryTextRaw.replace(/\*\*/g, '').replace(/### (.*)/g, '$1').trim();

                    if (summaryText && !summaryText.toLowerCase().includes("not available")) {
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(10);
                        doc.setTextColor('#334155'); // slate-700
                        
                        const textLines = doc.splitTextToSize(summaryText, CONTENT_WIDTH);
                        const isArabic = langKey === 'arabic';

                        const requiredHeight = (textLines.length * 5.5) + 8; // text height + padding after
                        if (currentY + requiredHeight > PAGE_HEIGHT - MARGIN) {
                            doc.addPage();
                            addPageHeader(doc);
                            currentY = MARGIN + 15;
                        }
                        
                        doc.text(textLines, MARGIN, currentY, { lang: isArabic ? 'ar' : 'en', align: isArabic ? 'right' : 'left' });
                        currentY += (textLines.length * 5.5) + 8; // Add space after the summary
                    }
                }
    
                // Add Chart
                const chartHeight = 80;
                if (currentY + chartHeight > PAGE_HEIGHT - MARGIN) {
                    doc.addPage();
                    addPageHeader(doc);
                    currentY = MARGIN + 15;
                }

                // Temporarily disable animation for capture
                const originalAnimation = chartInstance.options.animation;
                chartInstance.options.animation = false;
                
                allPanels.forEach(p => p.classList.add('hidden'));
                panel.classList.remove('hidden');
                chartInstance.resize();
                chartInstance.update('none');
                await new Promise(resolve => setTimeout(resolve, 100)); // Ensure render completes
                
                const chartImg = chartInstance.toBase64Image('image/jpeg', 0.85);
                
                // Restore animation
                chartInstance.options.animation = originalAnimation;

                 if (chartImg && chartImg !== 'data:,') {
                    doc.addImage(chartImg, 'JPEG', MARGIN, currentY, CONTENT_WIDTH, chartHeight);
                    currentY += chartHeight + 10;
                }
    
                // Add Table - jspdf-autotable handles its own page breaks
                const tableData = this.getCategoryTableData(category, ratioNames);
                (doc as any).autoTable({
                    head: [tableData.head],
                    body: tableData.body,
                    startY: currentY,
                    theme: 'grid',
                    margin: { left: MARGIN, right: MARGIN },
                    styles: {
                        fillColor: '#ffffff',
                        textColor: '#1e293b',
                        lineColor: '#e2e8f0', // slate-200
                        lineWidth: 0.1,
                        font: 'helvetica',
                    },
                    headStyles: {
                        fillColor: '#f1f5f9', // slate-100
                        textColor: '#0f172a', // slate-900
                        fontStyle: 'bold'
                    },
                    alternateRowStyles: {
                        fillColor: '#f8fafc' // slate-50
                    },
                });
            }

            // --- Final AI Analysis Pages ---
            this.showLoader('Structuring final analysis...');
            allPanels.forEach(p => p.classList.add('hidden'));
            document.getElementById('summary-content')?.classList.remove('hidden');

            const langKey = this.currentLanguage.toLowerCase() as 'english' | 'arabic';
            const mainAnalysisMarkdown = this.aiAnalyses[langKey].main;
            const aiSections = this.splitAiAnalysis(mainAnalysisMarkdown, this.currentLanguage);
            
            const renderPdfSection = async (markdownContent: string | undefined) => {
                if (!markdownContent || !markdownContent.trim()) return;
            
                doc.addPage();
                addPageHeader(doc);
            
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = this.formatAIResponse(markdownContent, true);
                if (this.currentLanguage === 'Arabic') tempDiv.classList.add('lang-ar');
                
                await addContentAsNativeText(doc, tempDiv, MARGIN + 15);
            };
            
            // Render each AI section on a new page in a specific order based on the prompt structure
            this.showLoader('Adding executive summary...');
            await renderPdfSection(aiSections.summary);

            this.showLoader('Adding Strengths...');
            await renderPdfSection(aiSections.strengths);

            this.showLoader('Adding Areas for Improvement...');
            await renderPdfSection(aiSections.improvements);
            
            this.showLoader('Adding Recommendations...');
            await renderPdfSection(aiSections.recommendations);
            
            this.showLoader('Adding conclusion...');
            await renderPdfSection(aiSections.conclusion);

            this.showLoader('Finalizing report...');
            addPageFooter(doc);
            doc.save(`AAA_Finance_Report_${this.analyzedData.map(c=>c.name).join('_')}.pdf`);
    
        } catch (error) {
            this.showError(`Failed to generate PDF: ${error.message}`);
            console.error(error);
        } finally {
            allPanels.forEach(p => p.classList.add('hidden'));
            activePanel?.classList.remove('hidden');
            this.hideLoader();
        }
    },
    
    getCategoryTableData(category: string, ratioNames: string[]): { head: string[], body: (string|number)[][] } {
        const analyzedData = this.analyzedData;
        const isMulti = analyzedData.length > 1;
    
        if (isMulti) {
            const selectedYear = (document.getElementById('year-selector') as HTMLSelectElement).value;
            const head = ['Ratio', ...analyzedData.map(c => c.name)];
            const body = ratioNames.map(rName => {
                const row: (string|number)[] = [rName];
                analyzedData.forEach(c => {
                    const yearIndex = c.name.includes('Benchmark') ? 0 : c.ratios['Year'].indexOf(selectedYear);
                    const value = yearIndex !== -1 ? c.ratios[rName]?.[yearIndex] : 'N/A';
                    row.push(this.formatRatioValue(value, rName));
                });
                return row;
            });
            return { head, body };
        } else {
            if (!analyzedData[0]) return { head: [], body: [] };
            const ratios = analyzedData[0].ratios;
            const periods = ratios['Year'] as string[];
            const head = ['Ratio', ...periods];
            const body = ratioNames.map(ratioName => {
                if (!ratios[ratioName]) return [];
                const rowData = ratios[ratioName].map(val => this.formatRatioValue(val, ratioName));
                return [ratioName, ...rowData];
            }).filter(row => row.length > 0) as (string|number)[][];
            return { head, body };
        }
    },

    async initializeChat(analyzedData: CompanyData[]) {
        if (!this.ai) return;
    
        this.chat = null;
        this.chatHistory = [];
    
        const dataString = JSON.stringify(
            analyzedData.map(c => ({ name: c.name, ratios: c.ratios })),
            (key, value) => (typeof value === 'number' && !isNaN(value)) ? parseFloat(value.toFixed(4)) : value
        );
    
        const systemInstruction = `You are 'AAA Finance', a helpful AI financial analyst. You have already performed an initial analysis on the following financial data and presented it to the user. Now, your role is to answer follow-up questions from the user.
    
    Base your answers PRIMARILY on the data provided below and the initial analysis (which you can infer from the data). You can also use your general financial knowledge to explain concepts (e.g., "What is ROE?"), but do not introduce new financial data about the companies that isn't present here. Keep your answers concise and conversational.
    
    Here is the financial ratio data you must use for context:
    \`\`\`json
    ${dataString}
    \`\`\`
    `;
        try {
            this.chat = this.ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: systemInstruction,
                },
            });
            // The chat is initialized with context. The UI history starts empty.
            this.chatHistory = [];
    
        } catch (error) {
            console.error("Failed to initialize chat:", error);
            this.showError("Could not start the chat session. Please try analyzing again.");
        }
    },

    async handleChatSubmit(event: Event) {
        event.preventDefault();
        if (!this.chat || !this.chatInput || this.chatInput.disabled) return;
    
        const userInput = this.chatInput.value.trim();
        if (!userInput) return;
    
        this.chatInput.value = '';
        this.chatInput.disabled = true;
        this.chatSendBtn.disabled = true;
        this.chatLoader.classList.remove('hidden');
    
        this.chatHistory.push({ role: 'user', content: userInput });
        this.renderChatHistory();
    
        try {
            const responseStream = await this.chat.sendMessageStream({ message: userInput });
    
            let fullResponse = '';
            this.chatHistory.push({ role: 'model', content: '...' }); // Add placeholder
            const modelMessageIndex = this.chatHistory.length - 1;
    
            for await (const chunk of responseStream) {
                fullResponse += chunk.text;
                this.chatHistory[modelMessageIndex].content = fullResponse + '...';
                this.renderChatHistory();
            }
            
            this.chatHistory[modelMessageIndex].content = fullResponse; // Final update without ellipsis
            this.renderChatHistory();
    
        } catch (error) {
            console.error("Chat error:", error);
            this.chatHistory.push({ role: 'model', content: `Sorry, I encountered an error: ${error.message}` });
            this.renderChatHistory();
        } finally {
            this.chatInput.disabled = false;
            this.chatSendBtn.disabled = false;
            this.chatLoader.classList.add('hidden');
            this.chatInput.focus();
        }
    },
    
    renderChatHistory() {
        if (!this.chatHistoryContainer) return;
        this.chatHistoryContainer.innerHTML = '';
        
        this.chatHistory.forEach(msg => {
            const messageEl = document.createElement('div');
            messageEl.className = `chat-message ${msg.role}`;
            
            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble';
            
            // Sanitize and format basic markdown
            let formattedContent = msg.content
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

            formattedContent = formattedContent
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');

            bubble.innerHTML = formattedContent;
            messageEl.appendChild(bubble);
            this.chatHistoryContainer.appendChild(messageEl);
        });
        
        this.chatHistoryContainer.scrollTop = this.chatHistoryContainer.scrollHeight;
    },

    showLoader(message: string) {
        this.loadingText.textContent = message;
        this.loader.classList.remove('hidden');
        this.analyzeBtn.disabled = true;
    },

    hideLoader() {
        this.loader.classList.add('hidden');
        this.analyzeBtn.disabled = false;
    },

    showError(message: string) {
        this.errorMessage.textContent = message;
        this.errorContainer.classList.remove('hidden');
    },
    
    hideError() {
        this.errorContainer.classList.add('hidden');
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());