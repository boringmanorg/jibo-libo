/** Google Search Console: top 30 pages by clicks, 12 Oct–9 Nov 2026.
 * Editorial guest questions, not a claim that Google currently displays these in PAA.
 * Answers are grounded in the corresponding page and shared policy sources.
 */
import { BISTRO_HOURS_SENTENCE, BISTRO_LUNCH_DETAILS } from './tabBistroHours';
import { PANORAMA_STAY_ONLY } from './panoramaPricing';

export type RankedQuestion = { q: string; a: string };
const suitePrice = `₹${PANORAMA_STAY_ONLY.toLocaleString('en-IN')}`;
const suiteQuestions: RankedQuestion[] = [
  { q: 'Where is Experience by XTSY in Shillong?', a: 'Experience by XTSY is a panoramic glass suite at XTSY Travellers Hostel, Mawdiangdiang Road, New Shillong Township, near IIM Shillong and NIFT Shillong.' },
  { q: 'What does an Experience by XTSY stay include?', a: `The ${suitePrice} nightly rate is GST-inclusive for the stay only. The suite has a queen bed for two, a private en-suite bathroom, climate control and Wi-Fi. Breakfast is not included.` },
  { q: 'Is stargazing guaranteed from the glass suite?', a: 'No. Sky visibility depends on clouds, rain, mist and other weather conditions. The panoramic glass suite can offer sky views on clear nights, but a booking does not guarantee visible stars.' },
];
const partnerQuestion = { q: 'Does XTSY own accommodation here?', a: 'XTSY’s own property is only in New Shillong Township. For nights outside Shillong, the desk arranges accommodation through trusted local partners; confirm the property, facilities and availability before booking.' };
const enquiryQuestion = { q: 'How can I request a tailored itinerary?', a: 'Share your dates, group size, preferred stops and budget with the XTSY desk on WhatsApp. Ask the desk to confirm the itinerary, transport, stays, inclusions and quote before booking.' };

export const RANKED_PAGE_QUESTIONS: Record<string, RankedQuestion[]> = {
  '/': [
    { q: 'Where is XTSY Travellers Hostel?', a: 'XTSY Travellers Hostel is on Mawdiangdiang Road, New Shillong Township, Shillong, Meghalaya 793018, near NIFT Shillong and IIM Shillong.' },
    { q: 'Which stays can I enquire about at XTSY?', a: 'Choose an 8-bed or 6-bed mixed dorm, a 4-bed women-only dorm, the King Double private room or Experience by XTSY. Use the booking page to share your dates and send a WhatsApp enquiry; the desk confirms availability.' },
    { q: 'Are XTSY stays in other towns owned by XTSY?', a: partnerQuestion.a },
    { q: 'Can I eat at XTSY?', a: `TAB Bistro by XTSY is on site. ${BISTRO_HOURS_SENTENCE}` },
  ],
  '/experience-by-xtsy': suiteQuestions,
  '/work-from-home': [
    { q: 'What is included in XTSY’s Shillong workation plans?', a: 'The page lists weekly, monthly and quarterly plans with a stay, Wi-Fi, workspace access and breakfast. Laundry and other inclusions vary by plan, so confirm the selected plan with the desk.' },
    { q: 'Where is the workation stay?', a: 'The XTSY workation stay is at XTSY Travellers Hostel in New Shillong Township, with TAB Bistro on site for meals and coffee.' },
    { q: 'Can I combine remote work with Meghalaya day trips?', a: 'Yes. The desk can help plan time off around Shillong, Sohra, Dawki and Mawlynnong. Keep sightseeing separate from working hours and confirm transport for your dates.' },
  ],
  '/pre-wedding-shoot-meghalaya': [
    { q: 'What locations does the Meghalaya pre-wedding guide cover?', a: 'The guide covers river scenery at Dawki, waterfall settings and living root bridges. Choose locations around the time available, weather and walking required rather than trying to visit them all in one shoot.' },
    { q: 'Can rain affect a pre-wedding shoot in Meghalaya?', a: 'Yes. Rain and mist can affect outdoor photography, access and visibility, especially during the monsoon. Agree on an alternative location or flexible schedule with your photographer.' },
    enquiryQuestion,
  ],
  '/workation-tawang': [
    { q: 'What should I confirm before booking a Tawang workation?', a: 'Confirm the accommodation, internet connection, backup connectivity, workspace, power backup and weekly or monthly quote for your dates. Do not assume that every property offers the same facilities.' },
    partnerQuestion,
    enquiryQuestion,
  ],
  '/luxury-glamping-shillong': suiteQuestions,
  '/3-day-mizoram-itinerary': [
    { q: 'Can I adapt the three-day Mizoram itinerary?', a: 'Yes. Treat it as a starting plan and confirm the stops, travel time and accommodation for your arrival and departure dates with the desk.' },
    partnerQuestion,
    enquiryQuestion,
  ],
  '/budget-trip-meghalaya': [
    { q: 'What costs should I include in a Meghalaya trip budget?', a: 'Allow for accommodation, meals, transfers, day-trip transport, attraction entry and activities. Shared transport and splitting a cab can help control costs; get current quotes before committing to a total budget.' },
    { q: 'Can I stay in Shillong and explore Meghalaya?', a: 'Shillong can be a base for day trips, while overnight stays closer to distant stops reduce return driving. XTSY’s own stay is in New Shillong Township; accommodation elsewhere is arranged through partners.' },
    enquiryQuestion,
  ],
  '/backpacking-northeast-india': [
    { q: 'What does the Northeast India backpacking guide cover?', a: 'The guide covers routes, budgets, permits, stays and travel planning across the Northeast, including Meghalaya and Sikkim. Plan each state separately rather than assuming one route or permit rule covers the whole region.' },
    partnerQuestion,
    enquiryQuestion,
  ],
  '/best-hostel-in-shillong': [
    { q: 'Which dorm options does XTSY offer in Shillong?', a: 'XTSY offers 8-bed and 6-bed mixed dorms and a 4-bed women-only dorm. Private options include the King Double room and Experience by XTSY. Confirm availability for your dates with the desk.' },
    { q: 'Is XTSY in Police Bazaar?', a: 'No. XTSY is on Mawdiangdiang Road in New Shillong Township, near NIFT Shillong and IIM Shillong. Plan a cab journey if you want to visit Police Bazaar.' },
    { q: 'How do I enquire about a hostel bed?', a: 'Choose your room and dates on the XTSY booking page, enter your guest details and send the WhatsApp enquiry. Availability and the booking are confirmed by the desk, not by submitting the enquiry alone.' },
  ],
  '/travel-guide/guwahati-to-shillong-transport': [
    { q: 'Which transport options connect Guwahati and Shillong?', a: 'The guide covers shared taxis, private cabs and buses. Choose a private cab for a direct transfer, or check shared-taxi and bus pickup points and departure availability before travelling.' },
    { q: 'How much time should I allow to drive from Guwahati to Shillong?', a: 'Allow about 3–3.5 hours in normal traffic, and longer during rain or busy periods. Keep extra time for an onward flight or train rather than treating this as a guaranteed journey time.' },
    { q: 'Will a shared taxi take me directly to XTSY?', a: 'Most shared taxis drop at Police Bazaar or Khyndailad. Arrange the onward transfer to Mawdiangdiang Road, New Shillong Township, or request a direct private transfer with the XTSY desk.' },
  ],
  '/10-day-meghalaya-itinerary': [
    { q: 'What does the ten-day Meghalaya route cover?', a: 'The plan begins with Shillong and Sohra, continues to the Nongriat root-bridge trail and the Umngot River, then explores the Jaintia Hills before returning to Shillong.' },
    { q: 'Should I allow extra time for Nongriat?', a: 'Yes. The trail starts at Tyrna and includes thousands of steps. The itinerary keeps time for the walk and recovery instead of combining a demanding trek and a long onward drive in one afternoon.' },
    { q: 'Why does the ten-day plan include a buffer?', a: 'Rain, visibility and road conditions can change sightseeing plans. A local or buffer day and a return to Shillong before departure reduce the risk of rushing a long transfer.' },
  ],
  '/destination-wedding-shillong': [
    { q: 'Where is XTSY’s Shillong wedding venue?', a: 'The venue is at XTSY in New Shillong Township, with mountain-view spaces, TAB Bistro catering, guest accommodation and event coordination.' },
    { q: 'Can wedding guests stay at XTSY?', a: 'Dorms, private rooms and Experience by XTSY provide on-site stay options. Share the guest list and dates so the desk can confirm the available accommodation mix.' },
    { q: 'What details are needed for a wedding quote?', a: 'Share your dates, guest count, event schedule, catering preferences, accommodation needs and décor requirements. Larger or multi-day celebrations are quoted around the plan rather than given an automatic fixed price.' },
  ],
  '/destinations/meghalaya/shillong/nongjrong-sunrise-viewpoint': [
    { q: 'When should I arrive at Nongjrong for sunrise?', a: 'Arrive before dawn and plan an early departure from Shillong; the guide allows about two hours by road. Carry warm clothes because mornings can be cold.' },
    { q: 'When is Nongjrong’s sea of clouds most likely?', a: 'The guide recommends November to February for dramatic sea-of-clouds sunrises. Clouds and sunrise visibility are weather-dependent, not guaranteed.' },
    { q: 'What can I do at Nongjrong?', a: 'The guide highlights sunrise photography, sea-of-clouds viewing and village exploration. Check weather and transport before the early-morning trip.' },
  ],
  '/destinations/meghalaya/shillong/umiam-lake': [
    { q: 'Can I stop at Umiam Lake on the way to Shillong?', a: 'Yes. Umiam Lake is north of Shillong on the Guwahati–Shillong highway, so it can be an arrival stop if your timing and daylight allow.' },
    { q: 'What activities are available at Umiam Lake?', a: 'The guide covers boating, kayaking, pedal-boating, lakeside picnics and photography. Check activity availability and conditions with the local water-sports operator.' },
    { q: 'When should I visit Umiam Lake for photographs?', a: 'The guide recommends early mornings for mist and reflections, and sunset for photography. October to May usually offers clearer skies; visibility still depends on the weather.' },
  ],
  '/workation-cherrapunji': [
    { q: 'What should I check for a Cherrapunji workation stay?', a: 'Confirm Wi-Fi, backup power, a suitable work area, meals and the weekly or monthly quote with the accommodation provider before booking.' },
    partnerQuestion,
    enquiryQuestion,
  ],
  '/kongthong-whistling-village': [
    { q: 'Why is Kongthong called the whistling village?', a: 'Kongthong is known for Jingrwai Lawbei, the tradition in which a mother gives her child a personal melody used to call them, alongside their regular name.' },
    { q: 'Can I stay overnight in Kongthong?', a: 'The guide describes basic, community-run homestay options. Confirm availability and facilities locally or ask the XTSY desk to arrange a partner stay; XTSY does not own a property there.' },
    { q: 'What should I plan before visiting Kongthong?', a: 'Allow time for the road journey from Shillong and village exploration. Arrange transport and confirm accommodation if staying overnight, and respect residents’ privacy when photographing or recording.' },
  ],
  '/merch': [
    { q: 'Is XTSY merchandise available to buy now?', a: 'The collection is coming soon. The page offers a Notify me enquiry rather than immediate checkout, with prices to be announced at launch.' },
    { q: 'What is in the XTSY merchandise collection?', a: 'The collection includes travel bags, bottles, clothing and accessories, plus laptop sleeves, notebooks and other work-from-anywhere items.' },
    { q: 'Where is merchandise pickup planned?', a: 'The page lists pickup at XTSY Travellers Hostel or TAB Bistro by XTSY on Mawdiangdiang Road, New Shillong Township. Confirm ordering and pickup availability when the item launches.' },
  ],
  '/shillong-dormitory': [
    { q: 'Does XTSY have a four-bed mixed dorm?', a: 'No. The four-bed bookable dorm is women-only. Mixed dorm options are the six-bed and eight-bed dorms.' },
    { q: 'What facilities are described for XTSY dorm beds?', a: 'The dorm guide describes lockers, reading lights and charging points. Check the chosen room on the booking page and ask the desk about any specific requirements.' },
    { q: 'Where is the dormitory in Shillong?', a: 'XTSY Travellers Hostel is on Mawdiangdiang Road in New Shillong Township, near NIFT Shillong and IIM Shillong, rather than in Police Bazaar.' },
  ],
  '/tab-bistro': [
    { q: 'What are TAB Bistro’s official opening hours?', a: BISTRO_HOURS_SENTENCE },
    { q: 'Can I book a table or request lunch at TAB Bistro?', a: `Use Book a table for a breakfast or dinner request and share the time and party size. ${BISTRO_LUNCH_DETAILS} Lunch requests go to the desk on WhatsApp for confirmation; they are not an extra table-service window.` },
    { q: 'Are TAB Bistro menu prices GST-inclusive?', a: 'No. The official menu prices are exclusive of 5% GST. Check the menu and confirm the total with the desk when ordering or requesting catering.' },
  ],
  '/tours': [
    { q: 'What kinds of trips are in the XTSY tour catalogue?', a: 'The catalogue includes Meghalaya, Northeast India, other Indian destinations and international trips, with filters for interests such as couples, adventure and temple circuits.' },
    { q: 'Does every tour have a fixed price?', a: 'No. Some packages list a price while others are on request. Check the individual tour for duration and inclusions, and confirm a quote for your dates and group size.' },
    enquiryQuestion,
  ],
  '/workation-shillong': [
    { q: 'Where can I work remotely with XTSY in Shillong?', a: 'XTSY Travellers Hostel in New Shillong Township offers long-stay workation options with Wi-Fi, workspace access and breakfast. Confirm the facilities and selected plan for your dates.' },
    { q: 'Can I request a weekly or monthly workation quote?', a: 'Yes. Share your arrival date, length of stay and workspace needs with the desk to confirm availability, the rate and plan inclusions.' },
    { q: 'Can the desk help plan time off during a Shillong workation?', a: 'Yes. Ask about local sightseeing or trips toward Sohra and Dawki, allowing enough time for travel around your working schedule.' },
  ],
  '/2-day-meghalaya-itinerary': [
    { q: 'Can I customise a two-day Meghalaya trip?', a: 'Yes. Keep the route focused and share arrival and departure times with the desk. Confirm which stops fit the available road time instead of assuming the whole state can be covered in two days.' },
    { q: 'Can rain affect the two-day Meghalaya plan?', a: 'Yes. Rain, mist and road conditions can change sightseeing and travel times. Keep the stop list flexible and confirm conditions before leaving.' },
    enquiryQuestion,
  ],
  '/2-day-nagaland-itinerary': [
    { q: 'How should I use the two-day Nagaland itinerary?', a: 'Use it as a starting point for a short visit. Confirm the actual stops, transfers and stay locations for your arrival and departure times before booking.' },
    partnerQuestion,
    enquiryQuestion,
  ],
  '/3-day-nagaland-itinerary': [
    { q: 'Can the three-day Nagaland plan be tailored?', a: 'Yes. Share your travel dates and interests with the desk and confirm a practical route, accommodation and transport for the time available.' },
    partnerQuestion,
    enquiryQuestion,
  ],
  '/destinations/meghalaya/cherrapunji/kynrem-falls': [
    { q: 'Where can I view Kynrem Falls?', a: 'The guide places Kynrem Falls within Thangkharang Park near Cherrapunji, accessible by road, with waterfall and valley viewpoints.' },
    { q: 'When does Kynrem Falls have stronger flow?', a: 'June to September is recommended for dramatic water flow. Rain can also affect visibility, so check conditions before the visit.' },
    { q: 'What should I plan for a Kynrem Falls visit?', a: 'Allow for park entry and transport, and combine the visit with nearby Cherrapunji stops rather than making an unplanned long detour.' },
  ],
  '/destinations/meghalaya/cherrapunji/seven-sisters-falls': [
    { q: 'When can I see all seven streams at Seven Sisters Falls?', a: 'The guide recommends June to September, particularly after rainfall. Flow and visibility vary with the weather.' },
    { q: 'Where are the Seven Sisters Falls viewpoints?', a: 'The guide lists Eco Park Sohra and the Mawsmai viewpoint near Cherrapunji as viewing locations.' },
    { q: 'What should I carry to Seven Sisters Falls?', a: 'Carry a raincoat, especially during the monsoon, and leave flexibility for mist or rain that may hide the view.' },
  ],
  '/destinations/meghalaya/dawki/dawki-suspension-bridge': [
    { q: 'Where is Dawki Suspension Bridge?', a: 'The bridge is in Dawki town near the India–Bangladesh border, overlooking the river. The guide suggests combining it with a visit to the Umngot River.' },
    { q: 'When are the river views from Dawki Bridge clearest?', a: 'November to February is recommended for clearer winter water views. Rain and upstream conditions can change clarity.' },
    { q: 'How long should I allow for Dawki Bridge?', a: 'The guide describes it as a short stop of about 30 minutes for river views and photography. Allow separate time for boating or other river activities.' },
  ],
  '/destinations/meghalaya/dawki/dawki-umngot-river': [
    { q: 'When is the Umngot River at Dawki clearest?', a: 'The guide recommends November to February for clearer water. Monsoon rain can make the river murky, and clear water is never guaranteed.' },
    { q: 'How do I reach Dawki from Shillong?', a: 'The guide allows about three hours by road from Shillong. Arrange a taxi and leave extra time for traffic, weather and your return journey.' },
    { q: 'Can I combine Dawki with Shnongpdeng?', a: 'Yes. The guide recommends combining the river visit with Shnongpdeng. Confirm boating, camping and other activities with local operators, as they depend on conditions.' },
  ],
  '/destinations/meghalaya/nongstoin/langshiang-falls': [
    { q: 'Where is Langshiang Falls?', a: 'Langshiang Falls is near Nongstoin in the West Khasi Hills. The guide allows about three hours from Shillong and recommends planning transport in advance.' },
    { q: 'When does Langshiang Falls have its strongest flow?', a: 'The guide recommends June to October for maximum water flow. Check rain, road conditions and viewpoint visibility before travelling.' },
    { q: 'What can I do at Langshiang Falls?', a: 'The guide highlights waterfall viewing, photography and offbeat exploration. It is a remote visit, so arrange transport rather than relying on finding a return ride at the viewpoint.' },
  ],
};

export function rankedQuestionsFor(path: string): RankedQuestion[] | undefined {
  return RANKED_PAGE_QUESTIONS[path.replace(/\/$/, '') || '/'];
}