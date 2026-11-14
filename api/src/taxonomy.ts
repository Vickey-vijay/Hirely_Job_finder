/** Job domains with example roles and skills. Used for sign-up suggestions and for reading skills out of a resume. */
export type Domain = { name: string; roles: string[]; skills: string[] };

export const DOMAINS: Domain[] = [
  { name: "Software & IT", roles: ["Software Engineer", "Frontend Developer", "Backend Developer", "Full Stack Developer", "Data Engineer", "DevOps Engineer", "QA Engineer", "Mobile Developer", "Machine Learning Engineer", "IT Support Engineer"],
    skills: ["Python", "Java", "JavaScript", "TypeScript", "C++", "C#", ".NET", "Go", "Rust", "PHP", "Ruby", "Kotlin", "Swift", "React", "Angular", "Vue", "Node.js", "Django", "Flask", "Spring Boot", "FastAPI", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Linux", "Git", "CI/CD", "REST API", "GraphQL", "Microservices", "Kafka", "Spark", "Airflow", "Selenium", "Machine Learning", "Deep Learning", "NLP", "PyTorch", "TensorFlow", "Android", "iOS", "Flutter", "React Native", "HTML", "CSS"] },
  { name: "Data & Analytics", roles: ["Data Analyst", "Business Analyst", "Data Scientist", "BI Developer", "MIS Executive"],
    skills: ["Excel", "Advanced Excel", "Power BI", "Tableau", "SQL", "Python", "R", "Statistics", "Data Visualization", "Google Sheets", "VBA", "Looker", "SAS", "Forecasting", "A/B Testing"] },
  { name: "Sales & Business Development", roles: ["Sales Executive", "Business Development Executive", "Inside Sales Executive", "Account Manager", "Sales Manager", "Relationship Manager"],
    skills: ["B2B Sales", "B2C Sales", "Lead Generation", "Cold Calling", "CRM", "Salesforce", "Negotiation", "Key Account Management", "Channel Sales", "Field Sales", "Tele Sales", "HubSpot"] },
  { name: "Marketing & Content", roles: ["Digital Marketing Executive", "SEO Specialist", "Content Writer", "Social Media Manager", "Performance Marketing Manager", "Brand Manager", "Graphic Designer"],
    skills: ["SEO", "SEM", "Google Ads", "Meta Ads", "Google Analytics", "Content Writing", "Copywriting", "Social Media Marketing", "Email Marketing", "Canva", "Photoshop", "Illustrator", "Figma", "Video Editing", "Premiere Pro", "After Effects", "WordPress"] },
  { name: "Finance & Accounting", roles: ["Accountant", "Accounts Executive", "Financial Analyst", "Audit Associate", "Tax Associate", "Finance Manager", "Credit Analyst"],
    skills: ["Tally", "GST", "TDS", "Accounts Payable", "Accounts Receivable", "Bank Reconciliation", "Financial Reporting", "Taxation", "Auditing", "SAP FICO", "QuickBooks", "Zoho Books", "Payroll", "Financial Modelling", "Budgeting", "IFRS"] },
  { name: "HR & Recruitment", roles: ["HR Executive", "HR Generalist", "Recruiter", "Talent Acquisition Specialist", "HR Manager", "Payroll Executive"],
    skills: ["Recruitment", "Talent Acquisition", "Onboarding", "Payroll", "Employee Relations", "HRMS", "Performance Management", "Sourcing", "Naukri", "LinkedIn Recruiter", "Labour Law", "Statutory Compliance"] },
  { name: "Customer Support & BPO", roles: ["Customer Support Executive", "Customer Success Manager", "Technical Support Executive", "Process Associate", "Team Leader"],
    skills: ["Customer Service", "Voice Process", "Non Voice Process", "Chat Support", "Email Support", "Zendesk", "Freshdesk", "Ticketing", "Escalation Handling", "Typing", "English Communication", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam"] },
  { name: "Operations & Supply Chain", roles: ["Operations Executive", "Operations Manager", "Supply Chain Executive", "Logistics Coordinator", "Warehouse Manager", "Procurement Executive", "Project Manager"],
    skills: ["Operations Management", "Logistics", "Supply Chain", "Inventory Management", "Procurement", "Vendor Management", "Warehouse Management", "SAP MM", "Six Sigma", "Project Management", "PMP", "Agile", "Scrum", "Jira"] },
  { name: "Healthcare & Pharma", roles: ["Staff Nurse", "Pharmacist", "Medical Representative", "Lab Technician", "Medical Coder", "Clinical Research Associate", "Physiotherapist"],
    skills: ["Patient Care", "Nursing", "Medical Coding", "ICD-10", "CPT", "Pharmacovigilance", "Clinical Research", "GCP", "Phlebotomy", "Hospital Administration", "Pharma Sales", "Regulatory Affairs"] },
  { name: "Education & Training", roles: ["Teacher", "Lecturer", "Academic Counsellor", "Corporate Trainer", "Instructional Designer", "Tutor"],
    skills: ["Teaching", "Lesson Planning", "Classroom Management", "Curriculum Development", "CBSE", "Mathematics", "Physics", "Chemistry", "Biology", "English", "Counselling", "E-learning", "B.Ed"] },
  { name: "Engineering (Core)", roles: ["Mechanical Engineer", "Civil Engineer", "Electrical Engineer", "Design Engineer", "Site Engineer", "Quality Engineer", "Production Engineer", "Maintenance Engineer"],
    skills: ["AutoCAD", "SolidWorks", "CATIA", "Creo", "ANSYS", "Revit", "STAAD Pro", "MS Project", "Primavera", "PLC", "SCADA", "Quality Control", "Lean Manufacturing", "GD&T", "CNC", "HVAC", "Estimation", "Site Supervision"] },
  { name: "Design & Product", roles: ["UI/UX Designer", "Product Designer", "Product Manager", "Graphic Designer", "Motion Designer"],
    skills: ["Figma", "Adobe XD", "Sketch", "Wireframing", "Prototyping", "User Research", "Design Systems", "Product Strategy", "Roadmapping", "Photoshop", "Illustrator"] },
  { name: "Hospitality, Retail & Others", roles: ["Store Manager", "Retail Sales Associate", "Front Office Executive", "Chef", "Hotel Manager", "Receptionist", "Office Administrator", "Data Entry Operator", "Legal Associate"],
    skills: ["Retail Sales", "Visual Merchandising", "Store Operations", "Front Office", "Guest Relations", "Food Production", "Housekeeping", "Data Entry", "MS Office", "Office Administration", "Legal Drafting", "Contract Management"] },
];

export const ALL_SKILLS: string[] = [...new Set(DOMAINS.flatMap((d) => d.skills))];
export const ALL_ROLES: string[] = [...new Set(DOMAINS.flatMap((d) => d.roles))];

export const CITIES = ["Bengaluru", "Hyderabad", "Chennai", "Pune", "Mumbai", "Delhi", "Gurugram", "Noida", "Kolkata", "Ahmedabad", "Kochi", "Coimbatore", "Jaipur", "Chandigarh", "Indore", "Thiruvananthapuram", "Visakhapatnam", "Nagpur", "Lucknow", "Bhubaneswar", "Mysuru", "Madurai", "Vadodara", "Surat"];
