
export interface TourEnquiryData {
  packageTitle: string;
  packageDuration: string;
  packageDifficulty: string;
  packageCategory: string;
  packageLocation: string;
  travellers: number;
  preferredDate: string;
  groupType: string;
  perPersonPrice: number;
  totalAmount: number;
  guestName: string;
  email: string;
  whatsappNumber: string;
  city?: string;
  specialRequests?: string;
  userId?: string;
}

export interface TourEnquiryResponse {
  success: boolean;
  enquiryId?: string;
  error?: string;
}

function generateTourEnquiryId(): string {
  const prefix = 'XTSY-T';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Records a tour enquiry. The site has no database dependency, so the reference is
 * generated in the browser and the enquiry reaches the XTSY desk over WhatsApp --
 * every caller opens WhatsApp with the formatted enquiry. Nothing can fail here, so a
 * guest is never blocked and never told an enquiry was saved when it was not.
 */
export async function createTourEnquiry(data: TourEnquiryData): Promise<TourEnquiryResponse> {
  const enquiryId = generateTourEnquiryId();

  // Fire GTM event (client-side only; no backend involved)
  if (typeof window !== 'undefined' && (window as any).dataLayer) {
    (window as any).dataLayer.push({
      event: 'tour_booking_submitted',
      tour_package: data.packageTitle,
      tour_location: data.packageLocation,
      travellers: data.travellers,
      total_value: data.totalAmount,
      currency: 'INR',
      enquiry_id: enquiryId,
    });
  }

  return { success: true, enquiryId };
}
