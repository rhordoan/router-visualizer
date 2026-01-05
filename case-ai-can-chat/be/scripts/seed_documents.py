import asyncio
import logging
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.session import SessionLocal
from schemas.schemas import DocumentCreate
from services.document_service import document_service
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# Sample Healthcare HealthChat documentation
SAMPLE_DOCUMENTS = [
    {
        "title": "HealthChat Overview",
        "content": """HealthChat is an advanced AI-powered healthcare assistant designed to help healthcare professionals and patients access medical information and navigate healthcare systems efficiently.
        
        Built on large language models (LLMs), HealthChat provides accurate, evidence-based responses to healthcare queries while maintaining strict privacy standards. The system does not store personal health information and complies with HIPAA and PHIPA regulations.
        
        HealthChat assists with understanding medical terminology, treatment options, healthcare services, and system navigation. It serves as an educational tool and information resource, complementing professional medical advice.
        
        The system is trained on medical literature, healthcare guidelines, and system documentation to provide relevant, context-aware responses for both Canadian and US healthcare contexts.""",
        "category": "AI Services",
        "source": "https://healthchat.example.com/about",
    },
    {
        "title": "HealthChat Use Cases",
        "content": """HealthChat supports various healthcare scenarios to improve efficiency and access:

1. Medical Documentation: Assist healthcare professionals with clinical note templates, discharge summaries, and patient communication
2. Patient Education: Provide clear explanations of diagnoses, treatments, and procedures in understandable language
3. System Navigation: Help patients understand how to access services, book appointments, and navigate insurance coverage
4. Clinical Research: Support medical professionals in finding recent studies, treatment guidelines, and evidence-based protocols

Healthcare providers report significant time savings in documentation tasks, while patients gain better understanding of their care journey.""",
        "category": "Use Cases",
        "source": "https://healthchat.example.com/use-cases",
    },
    {
        "title": "Healthcare System Overview",
        "content": """Healthcare systems in Canada and the USA provide medical services through different models:

Canada: Universal healthcare system funded by taxes, providing essential medical services to all residents. Provincial and territorial governments manage healthcare delivery, with services including primary care, hospital care, and prescription drug coverage varying by province.

USA: Mixed public-private system with Medicare (seniors 65+), Medicaid (low-income), private insurance, and the Affordable Care Act marketplace. Healthcare providers include hospitals, clinics, and private practices with varying insurance acceptance.

Both systems emphasize preventive care, emergency services, specialist referrals, and patient rights. Access to care, wait times, and coverage specifics vary by location and insurance status.""",
        "category": "Healthcare Services",
        "source": "https://healthcare.example.com/systems",
    },
    {
        "title": "Telehealth Services",
        "content": """Telehealth provides remote healthcare delivery through digital communication technologies, expanding access to medical services.

Services include:
- Virtual consultations: Video or phone appointments with physicians and specialists
- Remote monitoring: Digital tracking of vital signs and chronic conditions
- E-prescriptions: Electronic prescription submission to pharmacies
- Mental health support: Online counseling and therapy sessions
- Follow-up care: Post-treatment check-ins and care coordination

Telehealth improves access for rural communities, mobility-limited patients, and routine care. It reduces travel time, wait times, and provides flexible scheduling. Most insurance plans now cover telehealth services, especially after recent healthcare innovations.

Patients need internet access, compatible devices, and may require assistance setting up virtual appointments.""",
        "category": "Telehealth",
        "source": "https://telehealth.example.com/services",
    },
    {
        "title": "Patient Records & Privacy",
        "content": """Patient medical records contain comprehensive health information and are protected by strict privacy regulations.

HIPAA (USA) and PHIPA (Canada) ensure:
- Confidential storage of medical records
- Patient right to access their own records
- Strict protocols for information sharing
- Consent requirements for data disclosure
- Security measures protecting electronic health records (EHR)

Patients can request medical records from healthcare providers, typically within 30 days. Records include test results, diagnoses, treatment plans, medications, and visit notes.

Electronic Health Records (EHR) enable secure sharing between authorized providers, improving care coordination. Patients increasingly have online portal access to view records, test results, and communicate with providers.

Data breaches must be reported, and healthcare organizations implement encryption, access controls, and staff training to protect sensitive information.""",
        "category": "Medical Records",
        "source": "https://privacy.healthcare.example.com",
    },
    {
        "title": "Preventive Care Programs",
        "content": """Preventive healthcare focuses on disease prevention and early detection, reducing long-term health costs and improving quality of life.

Key preventive services:
- Annual physical examinations and health screenings
- Vaccinations and immunizations (flu, COVID-19, childhood vaccines)
- Cancer screenings (mammograms, colonoscopy, PSA tests)
- Cardiovascular health monitoring (blood pressure, cholesterol)
- Diabetes screening and management
- Mental health assessments

Most insurance plans cover preventive care at no cost to patients under the Affordable Care Act (USA) or provincial health plans (Canada).

Wellness programs include:
- Nutrition counseling and weight management
- Smoking cessation support
- Exercise and fitness programs
- Stress management and mental health resources
- Chronic disease prevention education

Regular preventive care helps identify health issues early when treatment is most effective.""",
        "category": "Patient Care",
        "source": "https://prevention.healthcare.example.com",
    },
    {
        "title": "Emergency Services",
        "content": """Emergency medical services provide immediate care for urgent and life-threatening conditions.

When to seek emergency care:
- Chest pain or difficulty breathing
- Severe injuries or bleeding
- Sudden confusion, difficulty speaking, or loss of consciousness
- Severe allergic reactions
- Suspected stroke or heart attack symptoms

Emergency Department (ED) services:
- 24/7 availability for urgent medical needs
- Triage system prioritizes critical cases
- Diagnostic imaging and laboratory tests
- Stabilization and treatment
- Hospital admission coordination when needed

In Canada, emergency services are covered by provincial health insurance. In the USA, emergency departments must provide care regardless of insurance status, though costs may apply.

For non-life-threatening urgent care, consider urgent care clinics or telehealth options to reduce wait times and costs. Always call 911 for life-threatening emergencies.""",
        "category": "Emergency Services",
        "source": "https://emergency.healthcare.example.com",
    },
    {
        "title": "Mental Health Resources",
        "content": """Mental health services provide support for emotional, psychological, and behavioral well-being.

Available services:
- Psychiatric evaluation and medication management
- Individual, group, and family therapy
- Crisis intervention and suicide prevention hotlines
- Substance abuse treatment programs
- Support groups and peer counseling
- Mindfulness and stress reduction programs

Access options:
- Primary care physicians can provide referrals to mental health specialists
- Community mental health centers offer sliding-scale fees
- Employee assistance programs (EAP) provide confidential counseling
- Telehealth platforms enable remote therapy sessions
- Crisis hotlines available 24/7: National Suicide Prevention Lifeline (988), Crisis Text Line (text HOME to 741741)

Mental health is increasingly recognized as essential to overall health. Insurance coverage for mental health services continues to expand, with parity laws requiring equal coverage to physical health services.

Reducing stigma and promoting help-seeking behavior improves outcomes. Early intervention and ongoing support help manage conditions like depression, anxiety, PTSD, and other mental health challenges.""",
        "category": "Mental Health",
        "source": "https://mentalhealth.example.com/resources",
    },
    # Individual patient records for better RAG retrieval
    {
        "title": "Patient Record - Emma Hernandez (MRN1000000)",
        "content": """Patient: Emma Hernandez
Medical Record Number: MRN1000000
Age: 2 years
Gender: Male
Current Location: Room 2A, Surgery Unit
Admission Status: TRANSFERRED
Risk Level: STABLE
Primary Diagnosis: Pneumonia

Recent Vital Signs:
- Heart Rate: 60 bpm (normal)
- Blood Pressure: 122/76 mmHg (normal)
- Oxygen Saturation (SpO2): 99% (excellent)
- Temperature: 98.6°F (normal)

Active Clinical Alerts:
- Vital trends detected (WARNING level, AI confidence 90%)

Clinical Notes:
Patient showing stable vital trends and has been successfully transferred to appropriate unit for continued care. All vital signs within normal parameters. Continuous monitoring via AI systems including Vitals Model and Status Classifier.""",
        "category": "Patient Records",
        "source": "Hospital Patient Database - Surgery Unit",
    },
    {
        "title": "Patient Record - Isabella Johnson (MRN1000001)",
        "content": """Patient: Isabella Johnson
Medical Record Number: MRN1000001
Age: 17 years
Gender: Female
Current Location: Room 4B, Emergency Department
Admission Status: ER (Emergency Room)
Risk Level: WARNING - Requires Close Monitoring
Primary Diagnosis: Pneumonia

Recent Vital Signs:
- Heart Rate: 128 bpm (elevated)
- Blood Pressure: 129/66 mmHg (within range)
- Oxygen Saturation (SpO2): 95% (declining trend)
- Temperature: 98.6°F (normal)

Active Clinical Alerts:
- PRIORITY: Oxygen Saturation Declining - SpO2 dropped from 98% to 94% over 2 hours (WARNING, AI confidence 94%)

Laboratory Results:
- CBC (Complete Blood Count): 8.2 K/μL (elevated, flagged)
- Cardiac Enzymes: 0.02 ng/mL (elevated, requires attention)
- Basic Metabolic Panel: 142 mmol/L (within range)
- Liver Function: 45 U/L (within range)

AI Clinical Insights:
- Consider cardiology consult due to elevated cardiac enzymes
- Oxygen saturation trending down requiring continuous monitoring
- Physician notification sent for critical lab results

AI Activity:
- Escalation: Physician notification sent for critical lab result requiring immediate attention
- Data processed through: Vitals Model → Status Model → Reasoning Model → Orchestrator
- Multiple models monitoring patient status continuously""",
        "category": "Patient Records",
        "source": "Hospital Patient Database - Emergency Department",
    },
    {
        "title": "Patient Record - Isabella Hernandez (MRN1000002)",
        "content": """Patient: Isabella Hernandez
Medical Record Number: MRN1000002
Age: 4 years
Gender: Male
Current Location: Room 2C, Emergency Department
Admission Status: ADMITTED
Risk Level: STABLE
Primary Diagnosis: Pneumonia

Recent Vital Signs:
- Heart Rate: 134 bpm (elevated for age)
- Blood Pressure: 102/90 mmHg
- Oxygen Saturation (SpO2): 97% (good)
- Temperature: 98.6°F (normal)

Active Clinical Alerts:
- Vitals stabilized - all vitals within normal range (WARNING, AI confidence 92%)

Clinical Status:
Patient condition has improved with all vital signs now stabilized within acceptable ranges. Continue current treatment plan with routine monitoring.""",
        "category": "Patient Records",
        "source": "Hospital Patient Database - Emergency Department",
    },
    {
        "title": "Patient Record - Liam Williams (MRN1000003)",
        "content": """Patient: Liam Williams
Medical Record Number: MRN1000003
Age: 9 years
Gender: Female
Current Location: Room 2D, Oncology Unit
Admission Status: ADMITTED
Risk Level: CRITICAL - Immediate Attention Required
Primary Diagnosis: Gastroenteritis

Recent Vital Signs:
- Heart Rate: 119 bpm (elevated)
- Blood Pressure: 126/80 mmHg
- Oxygen Saturation (SpO2): 95% (below optimal)
- Temperature: 98.6°F (normal)

Active Clinical Alerts:
- CRITICAL: Critical condition - immediate attention required (CRITICAL severity, AI confidence 88%)

Clinical Status:
Patient in critical condition requiring immediate medical attention and intensive monitoring. Care team has been notified. Continuous monitoring via AI Status Model and Reasoning Model active.""",
        "category": "Patient Records",
        "source": "Hospital Patient Database - Oncology Unit",
    },
    {
        "title": "Patient Record - William Miller (MRN1000004)",
        "content": """Patient: William Miller
Medical Record Number: MRN1000004
Age: 13 years
Gender: Female
Current Location: Room 4E, NICU (Neonatal Intensive Care Unit)
Admission Status: TRANSFERRED
Risk Level: WARNING
Primary Diagnosis: Pneumonia

Recent Vital Signs:
- Heart Rate: 98 bpm (normal)
- Blood Pressure: 113/84 mmHg (normal)
- Oxygen Saturation (SpO2): 95% (acceptable)
- Temperature: 98.6°F (normal)

Active Clinical Alerts:
- Vital trends detected - monitoring required (WARNING, AI confidence 88%)

Clinical Status:
Patient transferred to NICU for specialized care. Vital signs showing trends that require continued monitoring. AI systems actively tracking patient status.""",
        "category": "Patient Records",
        "source": "Hospital Patient Database - NICU",
    },
    {
        "title": "Patient Record - Ava Miller (MRN1000005)",
        "content": """Patient: Ava Miller
Medical Record Number: MRN1000005
Age: 11 years
Gender: Female
Current Location: Room 3H, Oncology Unit
Admission Status: ADMITTED
Risk Level: STABLE
Primary Diagnosis: Post-operative Recovery

Recent Vital Signs:
- Heart Rate: 88 bpm (normal)
- Blood Pressure: 118/75 mmHg (normal)
- Oxygen Saturation (SpO2): 98% (excellent)
- Temperature: 98.2°F (normal)

Active Clinical Alerts:
- No active alerts

Clinical Status:
Patient recovering well post-surgery with stable vital signs. All parameters within normal ranges. Continue routine post-operative monitoring protocol.""",
        "category": "Patient Records",
        "source": "Hospital Patient Database - Oncology Unit",
    },
    {
        "title": "Patient Record - James Johnson (MRN1000006)",
        "content": """Patient: James Johnson
Medical Record Number: MRN1000006
Age: 15 years
Gender: Male
Current Location: Room 4E, PICU (Pediatric Intensive Care Unit)
Admission Status: ADMITTED
Risk Level: WARNING
Primary Diagnosis: Respiratory Distress

Recent Vital Signs:
- Heart Rate: 105 bpm (elevated)
- Blood Pressure: 120/78 mmHg (normal)
- Oxygen Saturation (SpO2): 93% (below optimal)
- Temperature: 99.1°F (slightly elevated)

AI Activity:
- Admission flagged as high-risk due to unstable vitals requiring intensive monitoring
- Data processed through: Vitals Model → Status Model → Reasoning Model
- Continuous monitoring active in PICU setting

Clinical Status:
Patient admitted to PICU with respiratory distress. Requires close monitoring due to unstable vital signs, particularly oxygen saturation and heart rate. High-risk admission flagged by AI clinical decision support system.""",
        "category": "Patient Records",
        "source": "Hospital Patient Database - PICU",
    },
    {
        "title": "Patient Record - James Brown (MRN1000007)",
        "content": """Patient: James Brown
Medical Record Number: MRN1000007
Age: 8 years
Gender: Male
Current Location: Room 2B, PICU (Pediatric Intensive Care Unit)
Admission Status: ADMITTED
Risk Level: WARNING
Primary Diagnosis: Sepsis

Recent Vital Signs:
- Heart Rate: 112 bpm (elevated)
- Blood Pressure: 108/72 mmHg (low normal)
- Oxygen Saturation (SpO2): 96% (acceptable)
- Temperature: 100.2°F (fever)

AI Activity:
- Admission flagged as high-risk requiring intensive monitoring
- Continuous monitoring via Vitals Model and Status Classifier
- Alert generated for fever and elevated heart rate

Clinical Status:
Patient in PICU with sepsis diagnosis. Elevated temperature and heart rate require close monitoring. High-risk admission with active AI monitoring for early detection of deterioration.""",
        "category": "Patient Records",
        "source": "Hospital Patient Database - PICU",
    },
    {
        "title": "Patient Record - Mason Williams (MRN1000008)",
        "content": """Patient: Mason Williams
Medical Record Number: MRN1000008
Age: 14 years
Gender: Male
Current Location: Room 3D, Surgery Unit
Admission Status: ADMITTED
Risk Level: STABLE
Primary Diagnosis: Appendicitis

Recent Vital Signs:
- Heart Rate: 92 bpm (normal)
- Blood Pressure: 115/72 mmHg (normal)
- Oxygen Saturation (SpO2): 98% (excellent)
- Temperature: 99.0°F (slightly elevated)

Clinical Status:
Recently admitted patient. Stable condition. AI processing pending for comprehensive assessment. Standard surgical monitoring protocol in place.""",
        "category": "Patient Records",
        "source": "Hospital Patient Database - Surgery Unit",
    },
    {
        "title": "Patient Record - Sophia Brown (MRN1000009)",
        "content": """Patient: Sophia Brown
Medical Record Number: MRN1000009
Age: 6 years
Gender: Female
Current Location: Room 3G, General Medicine Unit
Admission Status: ADMITTED
Risk Level: STABLE
Primary Diagnosis: Dehydration

Recent Vital Signs:
- Heart Rate: 88 bpm (normal)
- Blood Pressure: 110/68 mmHg (normal)
- Oxygen Saturation (SpO2): 99% (excellent)
- Temperature: 98.4°F (normal)

Clinical Status:
Recently admitted for dehydration treatment. Stable condition with normal vital signs. AI processing pending. Standard rehydration protocol in progress.""",
        "category": "Patient Records",
        "source": "Hospital Patient Database - General Medicine",
    },
    {
        "title": "Patient Record - Olivia Davis (MRN1000010)",
        "content": """Patient: Olivia Davis
Medical Record Number: MRN1000010
Age: 10 years
Gender: Female
Current Location: Room 1A, Cardiology Unit
Admission Status: ADMITTED
Risk Level: WARNING
Primary Diagnosis: Arrhythmia (Irregular Heart Rhythm)

Recent Vital Signs:
- Heart Rate: 145 bpm (significantly elevated - tachycardia)
- Blood Pressure: 125/82 mmHg (slightly elevated)
- Oxygen Saturation (SpO2): 96% (acceptable)
- Temperature: 98.8°F (normal)

Active Clinical Alerts:
- Irregular heart rhythm detected - sustained tachycardia above 140 bpm (WARNING, AI confidence 91%)

Clinical Status:
Patient in Cardiology unit with diagnosed arrhythmia. Heart rate consistently elevated above 140 bpm indicating sustained tachycardia. Requires cardiac monitoring and specialist oversight. AI cardiac monitoring system active with continuous rhythm analysis.""",
        "category": "Patient Records",
        "source": "Hospital Patient Database - Cardiology Unit",
    },
    {
        "title": "Hospital Units and Patient Distribution Overview",
        "content": """Current patient distribution across hospital units:

PICU (Pediatric Intensive Care Unit):
- Location: Critical care area for pediatric patients
- Current Patients: 2 patients
- Patient List: James Johnson (MRN1000006) - Respiratory Distress, James Brown (MRN1000007) - Sepsis
- Typical Cases: Critical pediatric patients requiring intensive monitoring and care

Emergency Department:
- Current Patients: 2 patients  
- Patient List: Isabella Johnson (MRN1000001) - WARNING level, Isabella Hernandez (MRN1000002) - STABLE
- Function: Acute care and patient stabilization

Surgery Unit:
- Current Patients: 2 patients
- Patient List: Emma Hernandez (MRN1000000) - TRANSFERRED, Mason Williams (MRN1000008) - Appendicitis
- Function: Surgical procedures and post-operative care

Oncology Unit:
- Current Patients: 2 patients
- Patient List: Liam Williams (MRN1000003) - CRITICAL condition, Ava Miller (MRN1000005) - Post-op Recovery
- Function: Cancer treatment and specialized oncology care

Cardiology Unit:
- Current Patients: 1 patient
- Patient List: Olivia Davis (MRN1000010) - Arrhythmia
- Function: Cardiac care and heart rhythm monitoring

NICU (Neonatal Intensive Care Unit):
- Current Patients: 1 patient
- Patient List: William Miller (MRN1000004) - Pneumonia
- Function: Intensive care for critically ill newborns and infants

General Medicine Unit:
- Current Patients: 1 patient
- Patient List: Sophia Brown (MRN1000009) - Dehydration
- Function: General medical care and treatment

All patients monitored by AI clinical decision support systems including Vitals Model, Status Classifier, Reasoning Model, and Orchestrator for real-time assessment and alerting.""",
        "category": "Hospital Operations",
        "source": "Hospital Patient Database - Unit Summary",
    },
]


async def seed_documents():
    """
    Seed the database with sample Healthcare documentation
    Only runs if no documents exist (to prevent duplicates)
    """
    db: Session = SessionLocal()

    try:
        # Check if documents already exist
        from db.models import Document

        existing_count = db.query(Document).count()

        if existing_count > 0:
            logger.info(
                f"Database already contains {existing_count} documents. Skipping seed."
            )
            return existing_count

        logger.info("Starting document seeding process...")
        logger.info(f"Will create {len(SAMPLE_DOCUMENTS)} documents")

        success_count = 0
        failed_count = 0

        for doc_data in SAMPLE_DOCUMENTS:
            try:
                logger.debug(f"Creating document: {doc_data['title']}")

                document = DocumentCreate(
                    title=doc_data["title"],
                    content=doc_data["content"],
                    category=doc_data.get("category"),
                    source=doc_data.get("source"),
                    metadata={},
                )

                # Create document (user_id and conversation_id will be NULL for global documents)
                result = await document_service.create_document(db, document)
                logger.info(
                    f"  ✓ Created: '{doc_data['title']}' (ID {result.id}, {result.chunk_count} chunks)"
                )
                success_count += 1

            except Exception as e:
                logger.error(f"  ✗ Failed to create '{doc_data['title']}': {str(e)}")
                failed_count += 1

        logger.info("=" * 60)
        logger.info(
            f"Seeding completed! Success: {success_count}, Failed: {failed_count}, Total: {len(SAMPLE_DOCUMENTS)}"
        )
        logger.info("=" * 60)

        return success_count

    except Exception as e:
        logger.error(f"Error during seeding: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    # Setup logging for direct execution
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    logger.info("HealthChat Document Seeder")
    logger.info("=" * 60)

    try:
        result = asyncio.run(seed_documents())
        if isinstance(result, int) and result > 0:
            logger.info(f"Successfully seeded {result} documents")
        else:
            logger.info("Database already contains documents")
    except Exception as e:
        logger.error(f"✗ Seeding failed: {str(e)}")
        raise
