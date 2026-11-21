import { hostelPlatformScores } from '@/data/hostelPlatformScores';
import { logoFor } from '@/data/platformLogos';

export function PlatformScores() {
  return (
    <div className="mt-6 w-full text-center text-xt-paper">
      <p className="mb-4 text-sm font-bold">XTSY Travellers Hostel · guest ratings by platform</p>
      <dl aria-label="Hostel platform ratings" className="m-0 grid grid-cols-2 gap-x-5 gap-y-6 border-y border-xt-fog/20 py-6 sm:grid-cols-3 lg:grid-cols-6">
        {hostelPlatformScores.map((score) => (
          <div key={score.platform} className="min-w-0 text-center">
            <dt className="flex flex-col items-center gap-2 text-sm font-bold">
              {(() => { const l = logoFor(score.platform); return l ? <img src={l.src} alt="" width={40} height={40} loading="lazy" decoding="async" className="h-10 w-10 rounded-lg object-contain" /> : <span aria-hidden="true" className="flex h-10 items-center" />; })()}
              {score.platform}
            </dt>
            <dd className="m-0 mt-2 text-2xl font-extrabold">
              {score.value ? <>{score.value}<span className="text-sm font-normal text-xt-fog">/{score.scale}</span></> : <span className="text-sm text-xt-fog">Pending</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
