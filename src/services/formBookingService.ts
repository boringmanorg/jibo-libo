import { localEnquiryRef } from '@/lib/localEnquiry';
import { validateWhatsAppBooking } from "@/utils/whatsappBookingValidation";
import { validateXTSY270Inquiry, validateTourInquiry } from "@/utils/inquiryValidation";

interface WhatsAppBookingData {
  name: string;
  email: string;
  phone: string;
  city: string;
  pincode: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  specialRequests: string;
  selectedRooms: Array<{
    roomTypeId: string;
    roomTypeName: string;
    quantity: number;
    price: number;
  }>;
  nights: number;
  totalAmount: number;
  subtotal: number;
  taxes: number;
  breakfast: boolean;
  decoration: boolean;
}

interface XTSY270BookingData {
  state: string;
  city: string;
  pincode: string;
  mobile: string;
  email: string;
}

interface TourBookingData {
  name: string;
  email: string;
  phone: string;
  city: string;
  pincode: string;
  guests: number;
  selectedDate: string;
  tourName: string;
  duration: string;
  category: string;
  basePrice: number;
}

// Save WhatsApp booking using secure RPC function
export async function saveWhatsAppBooking(data: WhatsAppBookingData) {
  try {
    // Validate input data
    const validation = validateWhatsAppBooking({
      name: data.name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      pincode: data.pincode,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      guests: data.guests,
      specialRequests: data.specialRequests,
    });

    if (!validation.success) {
      const errorMessages = Object.values(validation.errors || {}).join(', ');
      return { success: false, error: `Validation failed: ${errorMessages}` };
    }

    return { success: true, bookingId: localEnquiryRef() };
  } catch (error: any) {
    console.error('Error saving WhatsApp booking:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}
