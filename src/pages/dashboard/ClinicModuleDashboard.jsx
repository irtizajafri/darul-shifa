import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserRound,
  Stethoscope,
  HeartPulse,
  Smile,
  FlaskConical,
  Waves,
  Radiation,
  Droplets,
  HelpCircle,
  BedDouble,
  LogOut,
  FileText,
} from 'lucide-react';
import { useModuleStore } from '../../store/useModuleStore';
import { useAuthStore } from '../../store/useAuthStore';
import { hasPermission } from '../../utils/permissions';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import hospitalLogo from '../../assets/download.png';
import './ClinicModuleDashboard.scss';

// subModule + optional tab mirrors AppRoutes guards exactly
const sections = [
  {
    title: 'Out Patients Department',
    color: 'blue',
    cards: [
      { title: 'General OPD',                  icon: UserRound,   path: '/clinic/general-opd',   subModule: 'general-opd' },
      { title: 'Consultant OPD',               icon: Stethoscope, path: '/clinic/consultant-opd', subModule: 'general-opd' },
      { title: 'Emergency & Chest Pain Clinic', icon: HeartPulse,  path: '/clinic/emergency-opd', subModule: 'general-opd' },
      { title: 'Dental',                       icon: Smile,       path: '/clinic/dental',        subModule: 'general-opd' },
      { title: 'Therapy',                      icon: Smile,       path: '/clinic/therapy',       subModule: 'general-opd' },
    ],
  },
  {
    title: 'Miscellaneous',
    color: 'purple',
    cards: [
      { title: 'Miscellaneous', icon: HelpCircle, path: '/clinic/miscellaneous', subModule: 'general-opd' },
      { title: 'Admission',     icon: BedDouble,  path: '/clinic/admission',     subModule: 'admission' },
      { title: 'Ambulance',     icon: BedDouble,  path: '/clinic/ambulance',     subModule: 'general-opd' },
    ],
  },
  {
    title: 'Diagnostic Department',
    color: 'teal',
    cards: [
      { title: 'Laboratory',                      icon: FlaskConical, path: '/clinic/laboratory',  subModule: 'general-opd' },
      { title: 'Ultra Sound, Echo & Color Doppler', icon: Waves,      path: '/clinic/ultrasound',  subModule: 'general-opd' },
      { title: 'Radiology',                       icon: Radiation,    path: '/clinic/radiology',   subModule: 'general-opd' },
      { title: 'Blood Bank',                      icon: Droplets,     path: '/clinic/blood-bank',  subModule: 'general-opd' },
    ],
  },
  {
    title: 'Payments',
    color: 'rose',
    cards: [
      { title: 'Discharge & Refund',   icon: LogOut,   path: '/clinic/discharge-refund',              subModule: 'billing', tab: 'discharge-refund' },
      { title: 'Consultant Statement', icon: FileText, path: '/clinic/reports/consultant-statement',   subModule: 'reports', tab: 'consultant-statement' },
    ],
  },
];

export default function ClinicModuleDashboard() {
  const { setModule } = useModuleStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    setModule('clinic');
  }, [setModule]);

  // Filter a card based on user permissions
  const canSeeCard = (card) => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return hasPermission(user, 'clinic', card.subModule, card.tab ?? null);
  };

  // Build filtered sections — hide empty sections too
  const visibleSections = sections
    .map((section) => ({
      ...section,
      cards: section.cards.filter(canSeeCard),
    }))
    .filter((section) => section.cards.length > 0);

  const handleCardClick = (card) => {
    if (card.path) navigate(card.path);
  };

  return (
    <div className="clinic-module-dashboard">
      <ClinicMenuBar />
      <div className="clinic-header">
        <img src={hospitalLogo} alt="Darul Shifa Clinic" className="clinic-header-logo" />
      </div>

      <div className="clinic-sections-grid">
        {visibleSections.map((section) => (
          <div key={section.title} className={`clinic-section section-${section.color}`}>
            <h2 className="section-title">{section.title}</h2>
            <div className="section-cards">
              {section.cards.map((card) => (
                <div
                  key={card.title}
                  className="dept-card dept-card--active"
                  onClick={() => handleCardClick(card)}
                >
                  <div className="dept-card-icon">
                    <card.icon className="w-5 h-5" />
                  </div>
                  <span className="dept-card-label">{card.title}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
