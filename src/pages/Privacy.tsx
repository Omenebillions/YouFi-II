import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, ExternalLink, Trash2, ArrowLeft } from 'lucide-react';

export default function Privacy() {
  const lastUpdated = "August 29, 2026";

  return (
    <div className="flex flex-col gap-6 pb-16 animate-in fade-in duration-300 max-w-4xl mx-auto px-3 sm:px-4">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mt-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0 shadow-2xs">
            <Lock size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-tight">YouFi Privacy Policy</h1>
            <p className="text-xs text-gray-500 mt-1 font-semibold">Last Updated: {lastUpdated}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/delete-account"
            className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 border border-red-200/70 rounded-xl px-3 py-2 transition-colors"
          >
            <Trash2 size={13} />
            <span>Account Deletion Portal</span>
          </Link>
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Privacy Standard</span>
          </div>
        </div>
      </div>

      {/* Main Policy Document Card */}
      <div className="flex flex-col gap-8 bg-white p-6 sm:p-10 rounded-3xl border border-gray-200/80 shadow-xs text-gray-800 leading-relaxed text-sm" id="privacy-content">
        
        {/* Intro */}
        <div className="space-y-3 pb-2 border-b border-gray-100">
          <p className="font-medium text-gray-700 text-sm leading-relaxed">
            YouFi ("YouFi", "we", "us", or "our") respects your privacy and is committed to protecting the information you provide when using the YouFi application, website, and related services.
          </p>
          <p className="text-gray-600 text-xs sm:text-sm">
            This Privacy Policy explains what information we collect, how we use it, how we protect it, when it may be shared, and the choices available to you.
          </p>
          <p className="text-gray-600 text-xs sm:text-sm font-semibold">
            By using YouFi, you acknowledge the practices described in this Privacy Policy.
          </p>
        </div>

        {/* Section 1: Information We Collect */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="w-2 h-5 bg-brand-600 rounded-full inline-block shrink-0"></span>
            1. INFORMATION WE COLLECT
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            We collect information necessary to provide YouFi's financial management, budgeting, business management, reporting, synchronization, and related services.
          </p>

          <div className="space-y-4 pl-1 sm:pl-3">
            {/* 1.1 */}
            <div className="bg-gray-50/80 rounded-2xl p-4 sm:p-5 border border-gray-100 space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900">1.1 Account Information</h3>
              <p className="text-xs text-gray-600">When you create or access a YouFi account, we may collect:</p>
              <ul className="list-disc pl-5 text-xs text-gray-600 space-y-1">
                <li>Name</li>
                <li>Email address</li>
                <li>Authentication information</li>
                <li>Profile information provided through supported sign-in providers</li>
                <li>Profile preferences</li>
              </ul>
              <p className="text-xs text-gray-600 pt-1">
                Authentication is handled using our authentication infrastructure and third-party authentication services where applicable.
              </p>
              <p className="text-xs font-semibold text-gray-700">
                We do not store your Google or other third-party account passwords.
              </p>
            </div>

            {/* 1.2 */}
            <div className="bg-gray-50/80 rounded-2xl p-4 sm:p-5 border border-gray-100 space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900">1.2 Personal Financial Information</h3>
              <p className="text-xs text-gray-600">Depending on the features you use, YouFi may store information such as:</p>
              <ul className="list-disc pl-5 text-xs text-gray-600 space-y-1">
                <li>Income</li>
                <li>Expenses</li>
                <li>Transactions</li>
                <li>Transaction descriptions or notes</li>
                <li>Budgets</li>
                <li>Savings goals</li>
                <li>Upcoming payments</li>
                <li>Financial plans</li>
                <li>Financial categories</li>
                <li>Currency preferences</li>
                <li>Other information you voluntarily enter into your financial records</li>
              </ul>
              <p className="text-xs text-gray-600 pt-1">
                This information is used to provide your personal financial management features, calculations, dashboards, reports, and other functionality you request.
              </p>
            </div>

            {/* 1.3 */}
            <div className="bg-gray-50/80 rounded-2xl p-4 sm:p-5 border border-gray-100 space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900">1.3 Business and SME Information</h3>
              <p className="text-xs text-gray-600">If you use YouFi's business-management features, we may collect information such as:</p>
              <ul className="list-disc pl-5 text-xs text-gray-600 space-y-1">
                <li>Business names and descriptions</li>
                <li>Business contact information</li>
                <li>Business addresses</li>
                <li>Products and inventory information</li>
                <li>Sales records</li>
                <li>Business transactions</li>
                <li>Business debts</li>
                <li>Business ideas</li>
                <li>Payment instructions</li>
                <li>Invoice-related information</li>
                <li>Business logos or branding</li>
                <li>Other business information you voluntarily provide</li>
              </ul>
              <p className="text-xs text-gray-600 pt-1">
                This information is used to provide business dashboards, financial records, reports, sales management, inventory management, and related features.
              </p>
            </div>

            {/* 1.4 */}
            <div className="bg-gray-50/80 rounded-2xl p-4 sm:p-5 border border-gray-100 space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900">1.4 AI and Automated Features</h3>
              <p className="text-xs text-gray-600">
                YouFi may provide AI-powered features such as financial insights, categorization, recommendations, summaries, or financial action plans.
              </p>
              <p className="text-xs text-gray-600">
                When you use these features, relevant information from your YouFi records may be processed to generate the requested result.
              </p>
              <p className="text-xs text-gray-600 italic">
                AI-generated information is provided as a convenience and should not be considered professional financial, investment, tax, accounting, or legal advice.
              </p>
              <p className="text-xs font-bold text-brand-700">
                We do not use your personal financial records for third-party advertising targeting or behavioral advertising profiling.
              </p>
            </div>

            {/* 1.5 */}
            <div className="bg-gray-50/80 rounded-2xl p-4 sm:p-5 border border-gray-100 space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900">1.5 Receipt and Camera Information</h3>
              <p className="text-xs text-gray-600">
                YouFi may allow you to use your device camera or upload images for receipt or document processing.
              </p>
              <p className="text-xs text-gray-600">Where applicable, images may be processed temporarily to extract relevant information such as:</p>
              <ul className="list-disc pl-5 text-xs text-gray-600 space-y-1">
                <li>Merchant names</li>
                <li>Dates</li>
                <li>Amounts</li>
                <li>Transaction descriptions</li>
                <li>Other receipt information</li>
              </ul>
              <p className="text-xs text-gray-600 pt-1">
                YouFi does not use receipt images for advertising purposes. You should avoid uploading documents containing information that is not necessary for the feature you are using.
              </p>
            </div>

            {/* 1.6 */}
            <div className="bg-gray-50/80 rounded-2xl p-4 sm:p-5 border border-gray-100 space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900">1.6 Device and Technical Information</h3>
              <p className="text-xs text-gray-600">Depending on how you access YouFi, we may process technical information such as:</p>
              <ul className="list-disc pl-5 text-xs text-gray-600 space-y-1">
                <li>Device type</li>
                <li>Operating system</li>
                <li>Browser information</li>
                <li>Application version</li>
                <li>IP address</li>
                <li>Network information</li>
                <li>Error and diagnostic information</li>
                <li>Authentication/session information</li>
              </ul>
              <p className="text-xs text-gray-600 pt-1">
                This information may be used to operate, secure, troubleshoot, and improve YouFi.
              </p>
            </div>

            {/* 1.7 */}
            <div className="bg-gray-50/80 rounded-2xl p-4 sm:p-5 border border-gray-100 space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900">1.7 Push Notifications</h3>
              <p className="text-xs text-gray-600">
                If you enable notifications, YouFi may store a device push token associated with your account.
              </p>
              <p className="text-xs text-gray-600">Push tokens may be used to deliver notifications such as:</p>
              <ul className="list-disc pl-5 text-xs text-gray-600 space-y-1">
                <li>Payment reminders</li>
                <li>Debt reminders</li>
                <li>Upcoming-payment alerts</li>
                <li>Other notifications you have enabled</li>
              </ul>
              <p className="text-xs text-gray-600 pt-1">
                You can control notification permissions through your device settings where supported.
              </p>
            </div>

            {/* 1.8 */}
            <div className="bg-gray-50/80 rounded-2xl p-4 sm:p-5 border border-gray-100 space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900">1.8 Offline and Local Storage</h3>
              <p className="text-xs text-gray-600">
                YouFi may store certain information locally on your device to support offline functionality, faster loading, caching, and temporary synchronization.
              </p>
              <p className="text-xs text-gray-600">
                Depending on the features you use, this may include locally cached financial or application data.
              </p>
              <p className="text-xs text-gray-600">
                Deleting the YouFi application, clearing application/browser storage, or using YouFi's account deletion functionality may remove locally stored information. However, device-level deletion behavior can vary by operating system and browser.
              </p>
            </div>
          </div>
        </section>

        <div className="h-px bg-gray-100 my-1" />

        {/* Section 2: How We Use Your Information */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="w-2 h-5 bg-brand-600 rounded-full inline-block shrink-0"></span>
            2. HOW WE USE YOUR INFORMATION
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">We use information collected through YouFi to:</p>
          <ul className="list-disc pl-6 text-xs sm:text-sm text-gray-600 space-y-1.5">
            <li>Create and maintain your account</li>
            <li>Authenticate users</li>
            <li>Store and synchronize your financial records</li>
            <li>Provide budgeting and financial-management features</li>
            <li>Calculate financial summaries and dashboards</li>
            <li>Manage savings goals</li>
            <li>Generate financial plans and AI-powered insights</li>
            <li>Provide business and SME management functionality</li>
            <li>Manage products, sales, debts, and business transactions</li>
            <li>Provide reminders and notifications</li>
            <li>Process receipt or document information when requested</li>
            <li>Maintain offline functionality and synchronization</li>
            <li>Provide customer support</li>
            <li>Detect, prevent, and investigate security issues</li>
            <li>Diagnose technical problems</li>
            <li>Improve the reliability and functionality of YouFi</li>
            <li>Process subscription and payment-related information</li>
            <li>Comply with applicable legal obligations</li>
          </ul>
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 text-xs sm:text-sm text-emerald-950 font-bold space-y-1">
            <p>✓ We do not sell your personal financial records.</p>
            <p>✓ We do not use your financial transaction history for third-party behavioral advertising or advertising profiling.</p>
          </div>
        </section>

        <div className="h-px bg-gray-100 my-1" />

        {/* Section 3: How We Store and Protect Your Information */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="w-2 h-5 bg-brand-600 rounded-full inline-block shrink-0"></span>
            3. HOW WE STORE AND PROTECT YOUR INFORMATION
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            YouFi uses industry-standard security measures designed to protect your information against unauthorized access, alteration, disclosure, or destruction.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            Our application infrastructure may use services such as Supabase and other trusted technology providers for authentication, databases, hosting, storage, notifications, analytics, AI processing, and payment-related functionality.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            Our database security architecture uses authentication and Row-Level Security (RLS) policies where applicable to restrict access to user-specific records.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            Communications between your device and supported YouFi services are protected using encrypted HTTPS/TLS connections.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            However, no internet-based service can guarantee absolute security. You should use a strong password, protect your devices and authentication credentials, and notify us if you believe your account has been compromised.
          </p>
        </section>

        <div className="h-px bg-gray-100 my-1" />

        {/* Section 4: Third-Party Service Providers */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="w-2 h-5 bg-brand-600 rounded-full inline-block shrink-0"></span>
            4. THIRD-PARTY SERVICE PROVIDERS
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            YouFi relies on trusted third-party providers to operate certain parts of the service. These providers may process information on our behalf or provide infrastructure necessary for YouFi to function.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">Depending on the features you use, these providers may include:</p>

          <div className="space-y-3 pl-1 sm:pl-3">
            <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 space-y-1">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900">Supabase</h3>
              <p className="text-xs text-gray-600">
                Supabase provides database, authentication, storage, and related backend infrastructure used by YouFi.
              </p>
            </div>

            <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 space-y-1.5">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900">Payment Providers</h3>
              <p className="text-xs text-gray-600">
                YouFi may use payment and platform billing services to process subscriptions and payments. Depending on the platform and payment method, this may include services such as:
              </p>
              <ul className="list-disc pl-5 text-xs text-gray-600 space-y-0.5">
                <li>Apple App Store / Apple StoreKit</li>
                <li>Google Play Billing</li>
                <li>Paystack</li>
                <li>Other payment providers integrated into YouFi</li>
              </ul>
              <p className="text-xs text-gray-600 pt-1">
                Payment providers may collect and process payment information according to their own privacy policies and terms. YouFi does not need to store your complete payment-card details when those details are processed directly by a payment provider.
              </p>
            </div>

            <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 space-y-1">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900">AI and Processing Providers</h3>
              <p className="text-xs text-gray-600">
                Certain YouFi features may use third-party AI or processing services to generate requested insights, categorization, summaries, or other automated results.
              </p>
              <p className="text-xs text-gray-600">
                Only information reasonably necessary to provide the requested functionality should be transmitted to such services. Third-party providers process information according to their applicable terms and privacy policies.
              </p>
            </div>
          </div>
        </section>

        <div className="h-px bg-gray-100 my-1" />

        {/* Section 5: When We Share Information */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="w-2 h-5 bg-brand-600 rounded-full inline-block shrink-0"></span>
            5. WHEN WE SHARE INFORMATION
          </h2>
          <p className="text-xs sm:text-sm font-bold text-gray-800">
            We do not sell your personal information or personal financial records.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">We may share information in limited circumstances, including:</p>

          <div className="space-y-3 pl-1 sm:pl-3">
            <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 space-y-1">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900">Service Providers</h3>
              <p className="text-xs text-gray-600">
                With trusted providers that help us operate YouFi, such as infrastructure, authentication, hosting, AI-processing, notification, security, and payment providers.
              </p>
            </div>

            <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 space-y-1">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900">Legal Requirements</h3>
              <p className="text-xs text-gray-600">When reasonably necessary to:</p>
              <ul className="list-disc pl-5 text-xs text-gray-600 space-y-0.5">
                <li>Comply with applicable law</li>
                <li>Respond to lawful requests</li>
                <li>Protect the rights, property, or safety of YouFi, our users, or others</li>
                <li>Detect or investigate fraud, abuse, or security incidents</li>
              </ul>
            </div>

            <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 space-y-1">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900">Business Transfers</h3>
              <p className="text-xs text-gray-600">
                If YouFi is involved in a merger, acquisition, restructuring, financing, sale of assets, or similar transaction, information may be transferred as part of that transaction, subject to applicable law.
              </p>
            </div>
          </div>
        </section>

        <div className="h-px bg-gray-100 my-1" />

        {/* Section 6: Data Retention */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="w-2 h-5 bg-brand-600 rounded-full inline-block shrink-0"></span>
            6. DATA RETENTION
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            We retain information for as long as reasonably necessary to provide YouFi services, maintain legitimate business records, comply with legal obligations, resolve disputes, enforce agreements, and protect the security of our systems.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            You may request deletion of your account and associated personal information as described below.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            Some information may need to be retained where required by law or where necessary for legitimate security, fraud-prevention, accounting, or legal purposes.
          </p>
        </section>

        <div className="h-px bg-gray-100 my-1" />

        {/* Section 7: Account Deletion */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="w-2 h-5 bg-brand-600 rounded-full inline-block shrink-0"></span>
            7. ACCOUNT DELETION
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            You can permanently delete your YouFi account through the account settings available after signing in, or via our public deletion portal.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            The account deletion process is designed to remove your account and associated application data, which may include:
          </p>
          <ul className="list-disc pl-6 text-xs sm:text-sm text-gray-600 space-y-1">
            <li>Account and profile information</li>
            <li>Personal transactions</li>
            <li>Budgets</li>
            <li>Savings goals</li>
            <li>Financial plans</li>
            <li>AI insights and plans</li>
            <li>Businesses</li>
            <li>Business transactions</li>
            <li>Products</li>
            <li>Sales</li>
            <li>Business debts</li>
            <li>Business ideas</li>
            <li>Upcoming payments</li>
            <li>Subscription records where applicable</li>
            <li>Push tokens</li>
            <li>Other account-associated application records</li>
          </ul>
          <p className="text-xs sm:text-sm text-gray-600">
            After successful server-side deletion, YouFi also attempts to clear relevant locally stored and offline data from the device.
          </p>
          <p className="text-xs sm:text-sm font-bold text-red-600">
            Account deletion is permanent and cannot be undone.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            If you cannot access your account, you may submit an account deletion request through YouFi's public account-deletion process at <Link to="/delete-account" className="text-brand-600 font-bold underline hover:text-brand-700">youfiapp.com/delete-account</Link> or contact us at:
          </p>
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 flex items-center gap-3">
            <Mail size={18} className="text-brand-600 shrink-0" />
            <a href="mailto:support@youfiapp.com" className="text-xs sm:text-sm font-bold text-brand-600 hover:text-brand-700 underline">
              support@youfiapp.com
            </a>
          </div>
          <p className="text-xs text-gray-500">
            For security reasons, submitting an email address alone does not immediately authorize deletion of an account. We may require verification that the requester controls the relevant account or email address before processing a deletion request.
          </p>
        </section>

        <div className="h-px bg-gray-100 my-1" />

        {/* Section 8: Requesting Deletion of Some Data */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="w-2 h-5 bg-brand-600 rounded-full inline-block shrink-0"></span>
            8. REQUESTING DELETION OF SOME DATA
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            You may contact us if you want to request deletion of specific personal information without deleting your entire YouFi account.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            Requests may be reviewed individually depending on the type of information involved, the reason it is processed, and applicable legal or regulatory requirements.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            Some information may not be removable where we are legally required or otherwise permitted to retain it.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">To make a request, contact:</p>
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 flex items-center gap-3">
            <Mail size={18} className="text-brand-600 shrink-0" />
            <a href="mailto:support@youfiapp.com" className="text-xs sm:text-sm font-bold text-brand-600 hover:text-brand-700 underline">
              support@youfiapp.com
            </a>
          </div>
          <p className="text-xs text-gray-500">
            We may need to verify your identity or account ownership before fulfilling a request.
          </p>
        </section>

        <div className="h-px bg-gray-100 my-1" />

        {/* Section 9: Your Privacy Rights */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="w-2 h-5 bg-brand-600 rounded-full inline-block shrink-0"></span>
            9. YOUR PRIVACY RIGHTS
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            Depending on where you live and applicable law, you may have rights relating to your personal information, including rights to:
          </p>
          <ul className="list-disc pl-6 text-xs sm:text-sm text-gray-600 space-y-1">
            <li>Access information we hold about you</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of personal information</li>
            <li>Request restriction of certain processing</li>
            <li>Object to certain processing</li>
            <li>Request portability of certain information</li>
            <li>Withdraw consent where processing is based on consent</li>
            <li>Lodge a complaint with an applicable data-protection authority</li>
          </ul>
          <p className="text-xs sm:text-sm text-gray-600">
            These rights are subject to applicable legal limitations and exceptions.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">To exercise an applicable privacy right, contact:</p>
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 flex items-center gap-3">
            <Mail size={18} className="text-brand-600 shrink-0" />
            <a href="mailto:support@youfiapp.com" className="text-xs sm:text-sm font-bold text-brand-600 hover:text-brand-700 underline">
              support@youfiapp.com
            </a>
          </div>
          <p className="text-xs text-gray-500">
            We may request reasonable information necessary to verify your identity before responding to a privacy request.
          </p>
        </section>

        <div className="h-px bg-gray-100 my-1" />

        {/* Section 10: Children's Privacy */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="w-2 h-5 bg-brand-600 rounded-full inline-block shrink-0"></span>
            10. CHILDREN'S PRIVACY
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            YouFi is not intended for children who are below the minimum age required to independently use the service under applicable law.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            We do not knowingly collect personal information from children in violation of applicable law.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            If you believe that a child has provided personal information to YouFi, please contact us at:
          </p>
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 flex items-center gap-3">
            <Mail size={18} className="text-brand-600 shrink-0" />
            <a href="mailto:support@youfiapp.com" className="text-xs sm:text-sm font-bold text-brand-600 hover:text-brand-700 underline">
              support@youfiapp.com
            </a>
          </div>
        </section>

        <div className="h-px bg-gray-100 my-1" />

        {/* Section 11: Cookies, Local Storage, and Similar Technologies */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="w-2 h-5 bg-brand-600 rounded-full inline-block shrink-0"></span>
            11. COOKIES, LOCAL STORAGE, AND SIMILAR TECHNOLOGIES
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            YouFi and its web application may use cookies, local storage, IndexedDB, service-worker caches, and similar technologies to:
          </p>
          <ul className="list-disc pl-6 text-xs sm:text-sm text-gray-600 space-y-1">
            <li>Maintain authentication sessions</li>
            <li>Remember preferences</li>
            <li>Support offline functionality</li>
            <li>Improve performance</li>
            <li>Cache application resources</li>
            <li>Provide essential application functionality</li>
            <li>Improve reliability and security</li>
          </ul>
          <p className="text-xs sm:text-sm text-gray-600">
            You can manage or clear certain browser storage through your browser settings. Clearing such storage may sign you out or affect offline functionality.
          </p>
        </section>

        <div className="h-px bg-gray-100 my-1" />

        {/* Section 12: International Data Processing */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="w-2 h-5 bg-brand-600 rounded-full inline-block shrink-0"></span>
            12. INTERNATIONAL DATA PROCESSING
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            YouFi and its service providers may process information in countries other than the country in which you live.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            Where required by applicable law, appropriate safeguards will be used for international transfers of personal information.
          </p>
        </section>

        <div className="h-px bg-gray-100 my-1" />

        {/* Section 13: Changes to this Privacy Policy */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="w-2 h-5 bg-brand-600 rounded-full inline-block shrink-0"></span>
            13. CHANGES TO THIS PRIVACY POLICY
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            We may update this Privacy Policy from time to time to reflect changes to YouFi, our technology, legal requirements, or our data practices.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            When we make material changes, we may provide an appropriate notice within the application, website, or through other reasonable means.
          </p>
          <p className="text-xs sm:text-sm text-gray-600">
            The "Last Updated" date at the top of this Privacy Policy indicates when it was most recently revised.
          </p>
        </section>

        <div className="h-px bg-gray-100 my-1" />

        {/* Section 14: Contact Us */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="w-2 h-5 bg-brand-600 rounded-full inline-block shrink-0"></span>
            14. CONTACT US
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            If you have questions, concerns, privacy requests, or account-deletion questions, contact us at:
          </p>
          <div className="bg-brand-50/60 border border-brand-100 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-3">
              <Mail size={18} className="text-brand-600 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-gray-900">Email:</span>
              <a href="mailto:support@youfiapp.com" className="text-xs sm:text-sm font-extrabold text-brand-600 hover:text-brand-700 underline">
                support@youfiapp.com
              </a>
            </div>
            <p className="text-xs text-gray-600">
              We encourage users to contact us if they have concerns about how their information is handled so that we can investigate and address the issue appropriately.
            </p>
          </div>

          <div className="pt-4 text-center sm:text-left">
            <p className="text-base font-black text-gray-900">YouFi</p>
            <p className="text-xs text-gray-500 font-medium">Financial management for your personal and business life.</p>
          </div>
        </section>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between px-2 text-xs font-semibold text-gray-500">
        <Link to="/terms" className="hover:text-gray-900 transition-colors flex items-center gap-1">
          <span>Terms of Service</span>
        </Link>
        <Link to="/delete-account" className="hover:text-red-600 transition-colors flex items-center gap-1">
          <Trash2 size={13} />
          <span>Public Account Deletion</span>
        </Link>
      </div>
    </div>
  );
}
