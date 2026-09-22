-- ==============================================================================
-- COMPREHENSIVE SEED DATA - INDIAN B2B ENTERPRISE ECOSYSTEM
-- ==============================================================================

-- 1. Demo Organization
INSERT INTO organizations (
    id, name, slug, domain, gstin, cin, industry, headquarters_city, headquarters_state, plan_tier, monthly_ai_budget, daily_ai_budget
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Apex Technologies India Pvt Ltd',
    'apex-technologies',
    'apextech.in',
    '29AAACA1234A1Z5',
    'U72200KA2020PTC134567',
    'B2B SaaS & AI Automation',
    'Bengaluru',
    'Karnataka',
    'ENTERPRISE',
    500.00,
    50.00
) ON CONFLICT (id) DO NOTHING;

-- 2. Organization Users (Admin, Sales Manager, SDRs)
INSERT INTO users (
    id, organization_id, email, full_name, phone, role, is_active
) VALUES 
(
    'u0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'vikram.malhotra@apextech.in',
    'Vikram Malhotra',
    '+919811022334',
    'ADMIN',
    true
),
(
    'u0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'ananya.sen@apextech.in',
    'Ananya Sen',
    '+919822033445',
    'SALES_MANAGER',
    true
),
(
    'u0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'rohit.verma@apextech.in',
    'Rohit Verma',
    '+919833044556',
    'SDR',
    true
),
(
    'u0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'priya.iyer@apextech.in',
    'Priya Iyer',
    '+919844055667',
    'SALES_REP',
    true
)
ON CONFLICT (id) DO NOTHING;

-- 3. Default ICP Configuration
INSERT INTO icp_configurations (
    id, organization_id, name, target_industries, target_employee_ranges, target_roles, target_geographies,
    weight_industry, weight_company_size, weight_role_seniority, weight_geography, weight_tech_fit, weight_business_signals, weight_contact_quality, minimum_qualifying_score
) VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Enterprise Indian B2B Tech & Manufacturing ICP',
    '["IT Services", "SaaS & Cloud", "Industrial Manufacturing", "Logistics & Supply Chain", "FMCG Distribution"]',
    '["50-200", "201-1000", "1001-5000", "5000+"]',
    '["Founder & CEO", "VP Sales", "Head of Business Development", "Chief Revenue Officer", "Chief Operating Officer", "Director of Sales"]',
    '["Bengaluru", "Mumbai", "Delhi NCR", "Pune", "Hyderabad", "Chennai", "Ahmedabad", "Kolkata"]',
    20, 15, 20, 10, 10, 15, 10, 70
) ON CONFLICT (id) DO NOTHING;

-- 4. Sample Indian Companies (Pvt Ltd, LLP, Ltd, MSME across Tech, Industrial, Logistics)
INSERT INTO companies (
    id, organization_id, name, legal_name, entity_type, domain, website, industry, sub_industry, employee_count_min, employee_count_max, annual_revenue_cr, gstin, city, state
) VALUES 
('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Bharat Forgings & Precision Ltd', 'Bharat Forgings & Precision Limited', 'LTD', 'bharatforgings.co.in', 'https://bharatforgings.co.in', 'Industrial Manufacturing', 'Auto Components', 850, 1200, 450.00, '27AAACB2345B1Z1', 'Pune', 'Maharashtra'),
('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'QuickLogix Supply Solutions Pvt Ltd', 'QuickLogix Supply Solutions Private Limited', 'PVT_LTD', 'quicklogix.in', 'https://quicklogix.in', 'Logistics & Supply Chain', 'Cold Chain & 3PL', 320, 600, 180.00, '06AAACQ4567Q1Z8', 'Gurugram', 'Haryana'),
('10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Kavach Cloud Systems LLP', 'Kavach Cloud Systems Limited Liability Partnership', 'LLP', 'kavachcloud.com', 'https://kavachcloud.com', 'SaaS & Cloud', 'Cybersecurity', 110, 250, 45.00, '29AABCK8910K1Z2', 'Bengaluru', 'Karnataka'),
('10000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Siddhivinayak Agro Distributors', 'Siddhivinayak Agro Enterprise', 'MSME', 'svagro.in', 'https://svagro.in', 'FMCG Distribution', 'Agricultural Supplies', 60, 150, 85.00, '24AAAPS9988S1Z0', 'Ahmedabad', 'Gujarat'),
('10000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Vanguard IT Solutions India Pvt Ltd', 'Vanguard IT Solutions India Private Limited', 'PVT_LTD', 'vanguardit.co.in', 'https://vanguardit.co.in', 'IT Services', 'Enterprise Consulting', 1200, 3000, 620.00, '36AAACV3456V1Z9', 'Hyderabad', 'Telangana')
ON CONFLICT (id) DO NOTHING;

-- 5. Leads & Contacts
INSERT INTO leads (
    id, organization_id, company_id, first_name, last_name, full_name, job_title, email, normalized_email, phone, normalized_phone, city, state, status, preferred_language, assigned_user_id
) VALUES
(
    '20000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Rajesh',
    'Sharma',
    'Rajesh Sharma',
    'VP Sales & Business Development',
    'rajesh.sharma@bharatforgings.co.in',
    'rajesh.sharma@bharatforgings.co.in',
    '+919876543210',
    '+919876543210',
    'Pune',
    'Maharashtra',
    'ENGAGED',
    'en',
    'u0000000-0000-0000-0000-000000000003'
),
(
    '20000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'Amitabh',
    'Chakraborty',
    'Amitabh Chakraborty',
    'Chief Operating Officer',
    'amitabh@quicklogix.in',
    'amitabh@quicklogix.in',
    '+919812345678',
    '+919812345678',
    'Gurugram',
    'Haryana',
    'MEETING',
    'hinglish',
    'u0000000-0000-0000-0000-000000000004'
),
(
    '20000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'Karthik',
    'Subramanian',
    'Karthik Subramanian',
    'Co-Founder & CEO',
    'karthik@kavachcloud.com',
    'karthik@kavachcloud.com',
    '+919890123456',
    '+919890123456',
    'Bengaluru',
    'Karnataka',
    'QUALIFIED_OPPORTUNITY',
    'en',
    'u0000000-0000-0000-0000-000000000003'
),
(
    '20000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000004',
    'Harish',
    'Patel',
    'Harish Patel',
    'Managing Director',
    'harish.patel@svagro.in',
    'harish.patel@svagro.in',
    '+919823456789',
    '+919823456789',
    'Ahmedabad',
    'Gujarat',
    'OUTREACH',
    'hi',
    'u0000000-0000-0000-0000-000000000003'
),
(
    '20000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000005',
    'Sunita',
    'Reddy',
    'Sunita Reddy',
    'Director - Enterprise Sales',
    'sunita.reddy@vanguardit.co.in',
    'sunita.reddy@vanguardit.co.in',
    '+919834567890',
    '+919834567890',
    'Hyderabad',
    'Telangana',
    'QUALIFIED',
    'en',
    'u0000000-0000-0000-0000-000000000003'
)
ON CONFLICT (id) DO NOTHING;

-- 6. Lead Scores
INSERT INTO lead_scores (
    lead_id, score, classification, reasoning, confidence, industry_score, size_score, role_score, geo_score, signals_score
) VALUES 
(
    '20000000-0000-0000-0000-000000000001',
    88,
    'HOT',
    '["Precision manufacturing leader expanding auto component export lines", "VP Sales role holds direct P&L and pipeline budget", "High geography fit (Pune industrial corridor)"]',
    0.92,
    20, 15, 20, 10, 13
),
(
    '20000000-0000-0000-0000-000000000002',
    94,
    'HOT',
    '["COO actively evaluating digital logistics tracking and sales acceleration", "3PL supply chain scaling rapidly in NCR & North India", "Immediate timeline this quarter"]',
    0.95,
    18, 15, 20, 10, 15
),
(
    '20000000-0000-0000-0000-000000000003',
    85,
    'HOT',
    '["Co-founder seeking automated SDR outbound to expand into US and Middle East", "Cybersecurity SaaS with proven Seed-stage product-market fit"]',
    0.89,
    20, 12, 20, 10, 13
),
(
    '20000000-0000-0000-0000-000000000004',
    72,
    'HIGH_FIT',
    '["MSME agro distributor with ₹85Cr turnover", "Requires simplified Hindi/Hinglish communication and WhatsApp-first engagement"]',
    0.84,
    14, 10, 18, 10, 10
),
(
    '20000000-0000-0000-0000-000000000005',
    82,
    'HIGH_FIT',
    '["Large IT services firm in Hyderabad corridor with 2000+ staff", "Director Enterprise Sales looking to reduce SDR ramp time"]',
    0.88,
    20, 15, 17, 10, 10
)
ON CONFLICT DO NOTHING;

-- 7. Verified Public Research Signals
INSERT INTO company_research (
    company_id, fact_key, fact_value, category, source, source_url, confidence, is_verified
) VALUES 
('10000000-0000-0000-0000-000000000001', 'export_expansion', 'Opened new forging facility in Chakan, Pune targeting European EV suppliers', 'EXPANSION', 'MCA_PORTAL', 'https://mca.gov.in', 0.95, true),
('10000000-0000-0000-0000-000000000002', 'hiring_sdr_fleet', 'Currently advertising 12 SDR and logistics account manager openings in Gurugram', 'HIRING', 'PUBLIC_WEBSITE', 'https://quicklogix.in/careers', 0.92, true),
('10000000-0000-0000-0000-000000000003', 'soc2_certified', 'Achieved SOC-2 Type II and ISO 27001 compliance for enterprise security cloud', 'TECH_STACK', 'PRESS_RELEASE', 'https://kavachcloud.com/press', 0.98, true);

-- 8. Sample Meetings
INSERT INTO meetings (
    id, organization_id, lead_id, host_user_id, title, description, start_time, end_time, meet_url, status, sales_brief
) VALUES (
    '30000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    'u0000000-0000-0000-0000-000000000004',
    'Discovery Call: Apex SDR x QuickLogix Cold-Chain Sales Automation',
    'Discovery session with Amitabh Chakraborty (COO) regarding automating outreach to cold storage clients.',
    NOW() + INTERVAL '1 day 4 hours',
    NOW() + INTERVAL '1 day 4 hours 30 minutes',
    'https://meet.google.com/apx-sdrs-ind',
    'CONFIRMED',
    '{
        "account_overview": "QuickLogix is a ₹180Cr revenue 3PL cold-chain provider operating across North and Western India.",
        "contact_role": "Amitabh Chakraborty is the COO, accountable for both operational efficiency and enterprise client acquisition.",
        "verified_pain_points": [
            "Current sales reps spending 18+ hours/week on manual LinkedIn and email follow-ups",
            "Slow follow-up on tier-2 industrial inquiries in Haryana and Rajasthan"
        ],
        "buying_signals": [
            "Actively hiring 12 sales reps",
            "Expressed keen interest in WhatsApp-based qualification during initial outreach"
        ],
        "recommended_questions": [
            "What is your current turnaround time between receiving a cold lead and booking a discovery call?",
            "How do your regional sales heads manage follow-up cadences in Hindi vs English?"
        ],
        "anticipated_objections": [
            "Concerned about WhatsApp message delivery rates and template approvals under Meta guidelines"
        ]
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;
