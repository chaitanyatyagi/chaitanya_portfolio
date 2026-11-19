// ---------------------------------------------------------------------------
// Public pages that attribute a Python interview question TYPE to a company
// (docs/QUESTION_BANK.md §1). A problem gets a company tag only through one of
// these helpers, so every tag carries a link a reader can check. Problems are
// original: the source names the kind of question, never the text we use.
//
//   dev('Stripe', 'idempotent event apply')       DEV company DE guides
//   dlp('Amazon', 'Two Sum')                       DataLemur Python questions
//   ddp('Visa', 'Twice on the Wire')               datadriven.io Python questions
//   ss('Airbnb', 'City With Most Amenities', 'top30' | 'ds' | 'coding')   StrataScratch
//   dv('Microsoft', 'flatten nested line_items')   DataVidhya company guides
//   gfg('Paytm', 'anagrams from a word list')      GeeksforGeeks interview experiences
//   lds('Target', 'target', 'Classify Orders by Value Tier')   Let's Data Science
//   web('JPMorgan', label, url)                    any other public write-up
// ---------------------------------------------------------------------------
const DEV = {
  Agoda: 'agoda-data-engineering-interview-questions-full-prep-guide-5aai',
  Airbnb: 'airbnb-data-engineering-interview-questions-prep-58ge',
  Amazon: 'amazon-data-engineering-interview-questions-prep-37nm',
  Atlassian: 'atlassian-data-engineering-interview-questions-nmf',
  Bloomberg: 'bloomberg-data-engineering-interview-questions-full-de-prep-guide-43',
  ByteDance: 'bytedance-data-engineering-interview-questions-guide-49o8',
  Cisco: 'cisco-data-engineering-interview-questions-3la5',
  Databricks: 'databricks-data-engineering-interview-questions-3g22',
  'Exodus Point': 'exodus-point-data-engineering-interview-questions-full-prep-guide-3fji',
  Figma: 'figma-data-engineering-interview-questions-12h2',
  Google: 'google-data-engineering-interview-questions-prep-guide-36c9',
  Intuit: 'intuit-data-engineering-interview-questions-3nic',
  Lyft: 'lyft-data-engineering-interview-questions-38ij',
  Meta: 'meta-data-engineering-interview-questions-top-topics-problems-solutions-304g',
  'Meta (Facebook)': 'facebook-data-engineering-interview-questions-prep-guide-1da6',
  Microsoft: 'microsoft-data-engineering-interview-questions-prep-2cdf',
  Netflix: 'netflix-data-engineering-interview-questions-10p7',
  Oracle: 'oracle-data-engineering-interview-questions-4haj',
  PayPal: 'paypal-data-engineering-interview-questions-1g0o',
  Rivian: 'rivian-data-engineering-interview-questions-full-de-prep-guide-1j8o',
  Robinhood: 'robinhood-data-engineering-interview-questions-prep-guide-hn',
  Roblox: 'roblox-data-engineering-interview-questions-full-de-prep-guide-3ho8',
  Salesforce: 'salesforce-data-engineering-interview-questions-5bo9',
  Snowflake: 'snowflake-data-engineering-interview-questions-prep-guide-10ko',
  Stripe: 'stripe-data-engineering-interview-questions-49l2',
  Techpath: 'techpath-data-engineering-interview-questions-32nc',
  Tesla: 'tesla-data-engineering-interview-questions-full-de-prep-guide-ed6',
  Uber: 'uber-data-engineering-interview-questions-prep-260c',
  Walmart: 'walmart-data-engineering-interview-questions-mem',
};

// variant picks a second guide for the same company: dev('Meta', what, 'Facebook').
export function dev(company, what, variant) {
  const slug = DEV[variant ? `${company} (${variant})` : company];
  if (!slug) throw new Error(`no DEV guide for ${company}${variant ? ` (${variant})` : ''}`);
  return { company, label: `DEV — ${variant || company} data engineering interview questions: ${what}`, url: `https://dev.to/gowthampotureddi/${slug}` };
}

export const dlp = (company, what) => ({ company, label: `DataLemur — ${company} Python question "${what}"`, url: 'https://datalemur.com/python-interview-questions' });

export const ddp = (company, what) => ({ company, label: `datadriven.io — ${company} data engineer Python question "${what}"`, url: 'https://datadriven.io/python-interview-questions' });

const SS = {
  top30: 'https://www.stratascratch.com/blog/top-30-python-interview-questions-and-answers',
  ds: 'https://www.stratascratch.com/blog/python-data-science-interview-questions',
  coding: 'https://www.stratascratch.com/blog/python-coding-interview-questions',
};
export const ss = (company, what, page = 'top30') => ({ company, label: `StrataScratch — ${company} Python interview question "${what}"`, url: SS[page] });

const DV = {
  Microsoft: 'microsoft', Meta: 'meta', Amazon: 'amazon', Google: 'google', LinkedIn: 'linkedin',
  Netflix: 'netflix', Stripe: 'stripe', Uber: 'uber', DoorDash: 'doordash', Airbnb: 'airbnb',
};
export const dv = (company, what) => ({ company, label: `DataVidhya — ${company} data engineer interview guide: ${what}`, url: `https://datavidhya.com/blog/${DV[company]}-data-engineering-interview-guide/` });

const GFG = {
  Paytm: 'interview-experiences/paytm-interview-experience-for-data-engineer/',
  'Paytm (2 yrs)': 'interview-experiences/paytm-interview-experience-for-data-engineer-2-years-experienced/',
  'Ernst & Young': 'interview-experiences/ey-interview-experience-for-data-engineer/',
  Amazon: 'interview-experiences/amazon-interview-experience-for-data-engineer/',
  'Bajaj Finserv': 'interview-experiences/bajaj-finserv-interview-experience-for-data-engineer/',
  'Tiger Analytics': 'interview-experiences/tiger-analytics-interview-experience-data-engineer-role/',
  Deloitte: 'interview-experiences/deconstructing-a-deloitte-data-engineer-interview/',
  Accenture: 'interview-experiences/data-engineer-hiring-experience-at-accenture-2025-26-batch-on-campus/',
  Virtusa: 'interview-experiences/virtusa-data-engineer-interview-experience-2025-26-batch/',
  'Goldman Sachs': 'goldman-sachs-interview-experience-for-data-engineering-senior-analyst',
  'Morgan Stanley': 'interview-experiences/morgan-stanley-interview-experience-for-data-engineer-2021/',
  Flipkart: 'interview-experiences/flipkart-interview-experience-for-data-engineering-i/',
  'Flipkart (DE 1)': 'interview-experiences/flipkart-interview-experience-for-data-engineer-1/',
  LTIMindtree: 'interview-experiences/ltimindtree-interview-experience-for-fresher/',
  Infosys: 'interview-experiences/infosys-interview-experience-for-digital-specialist-engineer-off-campus/',
  Sigmoid: 'sigmoid-analytics-company-interview-experience/',
  Cognizant: 'interview-experiences/cognizant-genc-interview-experience-for-job-role-programmer-analyst-data-science-data-engineer/',
};
export function gfg(company, what, variant) {
  const key = variant ? `${company} (${variant})` : company;
  if (!GFG[key]) throw new Error(`no GfG page for ${key}`);
  return { company, label: `GeeksforGeeks — ${company} interview experience: ${what}`, url: `https://www.geeksforgeeks.org/${GFG[key]}` };
}

// Let's Data Science — company interview problem lists (one page per company).
export const lds = (company, slug, what) => ({ company, label: `Let's Data Science — ${company} interview problem "${what}"`, url: `https://letsdatascience.com/problems/companies/${slug}` });

export const web = (company, label, url) => ({ company, label, url });
export const jpm = (what) => web('JPMorgan', `Preplaced — JPMorgan Chase data engineer interview experience: ${what}`, 'https://www.preplaced.in/blog/data-engineer-interview-experience-jp-morgan-chase');

// companies + sources from a list of source entries (one company may have several).
export const tag = (...sources) => ({ companies: [...new Set(sources.map((s) => s.company))], sources });
