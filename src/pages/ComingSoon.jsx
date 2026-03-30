import { useNavigate } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { useModuleStore } from '../store/useModuleStore';
import Button from '../components/ui/Button';
import './ComingSoon.scss';

export default function ComingSoon() {
  const navigate = useNavigate();
  const { clearModule } = useModuleStore();

  const handleBack = () => {
    clearModule();
    navigate('/dashboard');
  };

  return (
    <div className="coming-soon-page">
      <Construction className="coming-soon-icon" />
      <h1>Coming Soon</h1>
      <p className="subtitle">This module is under development</p>
      <p className="desc">We're working hard to bring you this feature soon.</p>
      <Button label="← Back to Dashboard" onClick={handleBack} variant="primary" />
    </div>
  );
}
