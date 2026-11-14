import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "../account";
import { rupees } from "../api";
import Transition from "../components/Transition";
import { Brand, Footer } from "../components/ui";

/**
 * Policy pages. Business name, email, address and grievance officer come from the server settings
 * (BUSINESS_NAME, CONTACT_EMAIL, BUSINESS_ADDRESS, GRIEVANCE_NAME), so they are edited in one place.
 * These are plain-language starting texts. Have a lawyer read them before you take money at scale.
 */
const UPDATED = "14 November 2026";

function Shell({ title, children }: { title: string; children: ReactNode }) {
  const { config } = useAccount();
  return (
    <Transition>
      <main className="page legal" style={{ maxWidth: 760 }}>
        <header className="topbar"><Brand /><Link to="/" className="btn soft sm">Home</Link></header>
        <h1 style={{ fontSize: "clamp(28px,5vw,40px)" }}>{title}</h1>
        <p className="muted small" style={{ marginTop: 6 }}>Last updated: {UPDATED}</p>
        {children}
        <Footer config={config} />
      </main>
    </Transition>
  );
}

function useBiz() {
  const { config } = useAccount();
  const b = config?.business;
  return {
    name: b?.name || "Hirely",
    email: b?.contactEmail || "(contact email will be published here before launch)",
    address: b?.address || "India",
    officer: b?.grievanceName || "The founder",
    plans: config?.plans ?? [],
  };
}

export function Terms() {
  const b = useBiz();
  return (
    <Shell title="Terms of Service">
      <h2>1. What {b.name} is</h2>
      <p>{b.name} is a paid job-alert service. You tell us the kind of job you want; we collect job openings from public sources, score how well each one fits your profile, and send you the ones that fit by WhatsApp, email and on your dashboard. On the Pro plan we also prepare a version of your resume written for a specific job.</p>
      <h2>2. What we do not promise</h2>
      <ul>
        <li>We are not an employer or a recruitment agency. We do not guarantee an interview, a job offer or a minimum number of matches.</li>
        <li>Job details come from the employer's own listing. We do not verify employers. Never pay anyone for a job or an interview; a genuine employer will not ask you to.</li>
        <li>The fit score is our estimate. You decide whether to apply.</li>
        <li>A tailored resume is a draft written by software from the resume you gave us. You must check it is accurate before using it.</li>
      </ul>
      <h2>3. Your account</h2>
      <p>You must be 18 or older and give accurate information. One account is for one person. Keep access to your email and Google account safe, because they are how you sign in.</p>
      <h2>4. Plans and price</h2>
      <ul>{b.plans.map((p) => <li key={p.id}><b>{p.name}</b>: {rupees(p.pricePaise)} per month. {p.features.slice(0, 2).join(". ")}.</li>)}</ul>
      <p>Prices include applicable taxes. If we change a price we will tell you by email at least 15 days before it applies to your next payment.</p>
      <h2>5. Payment, renewal and cancellation</h2>
      <p>Payments are handled by Razorpay. On a monthly plan you approve an automatic payment (UPI Autopay or card mandate) once, and the plan fee is collected each month until renewal is turned off. You can turn off renewal at any time in Settings; you can also cancel the mandate from your UPI or banking app. Full details are in our <Link className="link" to="/refunds">Refund and Cancellation Policy</Link>, which is part of these terms.</p>
      <h2>6. Messages</h2>
      <p>We send WhatsApp messages only if you switch them on, and only about your job matches and your account. Reply STOP to end them, or PAUSE to pause.</p>
      <h2>7. Acceptable use</h2>
      <p>Do not resell the alerts, copy our data in bulk, share your account, or try to break or overload the service. We may suspend an account that does.</p>
      <h2>8. Liability</h2>
      <p>We provide the service with reasonable care, but job sources can be late, wrong or unavailable. To the extent the law allows, our total liability to you is limited to the amount you paid us in the three months before the claim.</p>
      <h2>9. Changes and law</h2>
      <p>We may update these terms and will show the date above. These terms are governed by the laws of India, and courts at the place of our registered address have jurisdiction.</p>
      <h2>10. Contact and grievances</h2>
      <p>{b.name}, {b.address}. Email: {b.email}. Grievance officer: {b.officer}. See <Link className="link" to="/contact">Contact</Link>.</p>
    </Shell>
  );
}

export function Privacy() {
  const b = useBiz();
  return (
    <Shell title="Privacy Policy">
      <p style={{ marginTop: 14 }}>This notice explains what personal data {b.name} collects, why, and the choices you have, in line with India's Digital Personal Data Protection Act, 2023.</p>
      <h2>What we collect and why</h2>
      <ul>
        <li><b>Name, email and profile photo</b> (from Google sign-in or the email you type): to create your account and sign you in.</li>
        <li><b>Mobile number</b>: only to send the WhatsApp alerts you asked for.</li>
        <li><b>Job preferences</b> (roles, skills, cities, years of experience) and <b>the text of your resume</b>: to match jobs to you and, on Pro, to write tailored resumes. We store the extracted text only, not the uploaded file.</li>
        <li><b>Activity</b> (matches sent, jobs you marked as applied or hidden, your feedback): to improve your matches.</li>
        <li><b>Payment records</b> (plan, amount, date, payment ID): to give you access and keep accounts. Card, UPI and bank details are entered on Razorpay's pages and never reach our servers.</li>
      </ul>
      <p>We use your data only for these purposes, on the basis of the consent you give when you sign up and switch features on.</p>
      <h2>Who else handles your data</h2>
      <ul>
        <li><b>Razorpay</b>: payments.</li>
        <li><b>Meta (WhatsApp Business Platform)</b>: delivery of WhatsApp alerts to your number.</li>
        <li><b>Our email delivery provider</b>: sign-in codes and email alerts.</li>
        <li><b>Anthropic (Claude AI)</b>: when AI features are on, your job preferences and resume text are sent to it to score matches and write tailored resumes. It processes them to return the result to us.</li>
        <li><b>Our hosting provider</b>: the servers where the service runs. Some of these providers process data outside India.</li>
      </ul>
      <p>We do not sell your data, show ads, or share your details with employers. You apply to jobs yourself.</p>
      <h2>How long we keep it</h2>
      <p>For as long as your account is open. When you delete your account, your profile, resume text, matches and history are erased from our database straight away and from backups within 30 days. Payment records are kept for as long as tax law requires.</p>
      <h2>Your choices and rights</h2>
      <ul>
        <li>See and correct your data in Settings and your profile.</li>
        <li>Delete your resume, or your whole account, in Settings.</li>
        <li>Withdraw consent for WhatsApp or email alerts at any time (Settings, or reply STOP).</li>
        <li>Nominate another person to exercise your rights, or raise a complaint with us (below). If we do not resolve it, you may complain to the Data Protection Board of India.</li>
      </ul>
      <h2>Security</h2>
      <p>The site uses HTTPS. Sign-in codes are stored only as hashes, sessions use secure cookies, and access to the database is restricted. If a breach affects your data we will inform you and the Data Protection Board as the law requires.</p>
      <h2>Children</h2>
      <p>The service is for people aged 18 and above.</p>
      <h2>Contact</h2>
      <p>Data and grievance contact: {b.officer}, {b.name}, {b.address}. Email: {b.email}. We acknowledge complaints within 48 hours and aim to resolve them within 30 days.</p>
    </Shell>
  );
}

export function Refunds() {
  const b = useBiz();
  return (
    <Shell title="Refund and Cancellation Policy">
      <h2>The short version</h2>
      <ul>
        <li>You can turn off renewal at any time. It takes two taps in Settings.</li>
        <li>When you do, you keep your alerts until the end of the month you already paid for.</li>
        <li>We do not refund a month that has started, in full or in part.</li>
        <li>Got a job? Tap “I got a job” and we stop your next payment immediately.</li>
      </ul>
      <h2>Cancelling</h2>
      <p>Open Settings, then Plan and billing, then Stop renewal. You can also cancel the automatic payment (mandate) from your UPI app or bank; the result is the same. No further payment is taken after cancellation.</p>
      <h2>Why there are no refunds</h2>
      <p>The plan fee mostly pays for costs we incur for you as the month begins: servers, message delivery and AI processing. For that reason a period that has started is not refunded, including when you upgrade (the new plan starts the day you pay and the unused days of the old plan are not credited) and when you delete your account.</p>
      <h2>When we will return your money</h2>
      <ul>
        <li>You were charged twice for the same period.</li>
        <li>You were charged after you had turned off renewal.</li>
        <li>You paid but your plan was never activated and we could not fix it within 3 working days.</li>
        <li>The service was unavailable to you for more than 7 days in a row because of a fault on our side.</li>
      </ul>
      <p>Write to {b.email} from your account email with the payment ID (Settings shows it). Approved refunds go back to the original payment method, normally within 5 to 7 working days.</p>
      <h2>Failed payments</h2>
      <p>If a renewal payment fails, your payment provider may retry. If it still fails, your plan ends and nothing is owed.</p>
      <h2>Contact</h2>
      <p>{b.name}, {b.address}. Email: {b.email}.</p>
    </Shell>
  );
}

export function Contact() {
  const b = useBiz();
  const { config } = useAccount();
  return (
    <Shell title="Contact us">
      <div className="card" style={{ marginTop: 18 }}>
        <div className="setting"><span className="muted">Business</span><b>{b.name}</b></div>
        <div className="setting"><span className="muted">Email</span><span>{config?.business.contactEmail ? <a className="link" href={`mailto:${config.business.contactEmail}`}>{config.business.contactEmail}</a> : b.email}</span></div>
        <div className="setting"><span className="muted">Address</span><span style={{ textAlign: "right" }}>{b.address}</span></div>
        <div className="setting"><span className="muted">Grievance officer</span><span>{b.officer}</span></div>
        <div className="setting"><span className="muted">Reply time</span><span>Within 48 hours, Monday to Saturday</span></div>
      </div>
      <p style={{ marginTop: 16 }}>For billing questions, include the payment ID from Settings. To stop WhatsApp alerts straight away, reply STOP to any of our messages.</p>
      {config?.business.supportUpi && <p className="small muted" style={{ marginTop: 16 }}>Want to support the project? UPI: <b>{config.business.supportUpi}</b>. Entirely optional, and thank you.</p>}
    </Shell>
  );
}
