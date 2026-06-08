import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserRound,
  Stethoscope,
  HeartPulse,
  Smile,
  LayoutDashboard,
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
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import hospitalLogo from '../../assets/download.png';
import './ClinicModuleDashboard.scss';

const sections = [
  {
    title: 'Out Patients Department',
    color: 'blue',
    cards: [
      { title: 'General OPD', icon: UserRound, path: '/clinic/general-opd', active: true },
      { title: 'Consultant OPD', icon: Stethoscope, path: '/clinic/consultant-opd', active: true },
      { title: 'Emergency & Chest Pain Clinic', icon: HeartPulse, path: '/clinic/emergency-opd', active: true },
      { title: 'Dental', icon: Smile, path: '/clinic/dental', active: true },
      { title: 'Therapy', icon: Smile, path: '/clinic/therapy', active: true },
    ],
  },
  {
    title: 'Miscellaneous',
    color: 'purple',
    cards: [
      { title: 'Miscellaneous', icon: HelpCircle, path: '/clinic/miscellaneous', active: true },
      { title: 'Admission', icon: BedDouble, path: '/clinic/admission', active: true },
      { title: 'Ambulance', icon: BedDouble, path: null },
    ],
  },
  {
    title: 'Diagnostic Department',
    color: 'teal',
    cards: [
      { title: 'Laboratory', icon: FlaskConical, path: '/clinic/laboratory', active: true },
      { title: 'Ultra Sound, Echo & Color Doppler', icon: Waves, path: '/clinic/ultrasound', active: true },
      { title: 'Radiology', icon: Radiation, path: '/clinic/radiology', active: true },
      { title: 'Blood Bank', icon: Droplets, path: '/clinic/blood-bank', active: true },
    ],
  },
  {
    title: 'Payments',
    color: 'rose',
    cards: [
      { title: 'Discharge & Refund', icon: LogOut, path: null },
      { title: 'Consultant Statement', icon: FileText, path: null },
    ],
  },
];

export default function ClinicModuleDashboard() {
  const { setModule } = useModuleStore();
  const navigate = useNavigate();

  useEffect(() => {
    setModule('clinic');
  }, [setModule]);

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
        {sections.map((section) => (
          <div key={section.title} className={`clinic-section section-${section.color}`}>
            <h2 className="section-title">{section.title}</h2>
            <div className="section-cards">
              {section.cards.map((card) => (
                <div
                  key={card.title}
                  className={`dept-card ${card.active ? 'dept-card--active' : 'dept-card--soon'}`}
                  onClick={() => handleCardClick(card)}
                >
                  <div className="dept-card-icon">
                    <card.icon className="w-5 h-5" />
                  </div>
                  <span className="dept-card-label">{card.title}</span>
                  {!card.active && <span className="coming-soon-badge">Coming Soon</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
