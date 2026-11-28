import { Check, FileCheck2, ScanLine, ShieldCheck } from 'lucide-react';
import xtsyLogo from '@/assets/xtsy-color-logo.webp';
import type { CheckInPropertyId } from '@/checkin/checkInModel';

type Property = { id: CheckInPropertyId; name: string; location: string };

/** A single A4 portrait sign, shown only while printing from Self check-in. */
export function CheckInQrSign({ property, code, url }: { property: Property; code: string; url: string }) {
  return (
    <section className="checkin-a4-print" aria-label={`${property.name} self check-in A4 sign`}>
      <div className="checkin-a4-brand">
        <img src={xtsyLogo} alt="XTSY" />
      </div>
      <div className="checkin-a4-heading">
        <p>ARRIVAL MADE SIMPLE</p>
        <h1>SELF CHECK-IN</h1>
        <h2>{property.name}</h2>
        <span>{property.location}</span>
      </div>
      <div className="checkin-a4-scan">
        <ScanLine aria-hidden="true" />
        <strong>Scan here to check in</strong>
        <p>Use your phone camera. Have your identity documents ready.</p>
      </div>
      <img className="checkin-a4-code" src={code} alt={`QR code for ${property.name} self check-in`} />
      <ol className="checkin-a4-steps">
        <li><FileCheck2 aria-hidden="true" /><span><strong>Add your stay details</strong>Upload your ID, passport and visa where required.</span></li>
        <li><ShieldCheck aria-hidden="true" /><span><strong>Read and accept the policies</strong>Your room or bed preference is saved with your check-in.</span></li>
        <li><Check aria-hidden="true" /><span><strong>Show your receipt at the desk</strong>The front desk verifies your documents and allocates your room.</span></li>
      </ol>
      <div className="checkin-a4-footer">
        <span>{url}</span>
        <strong>Need help? Call +91 88373 17070</strong>
      </div>
    </section>
  );
}
