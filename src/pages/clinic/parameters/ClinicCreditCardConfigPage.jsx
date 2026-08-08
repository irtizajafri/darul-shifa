import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import PageHeader from '../../../components/shared/PageHeader';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { useClinicStore } from '../../../store/useClinicStore';
import './ClinicParameterPage.scss';

export default function ClinicCreditCardConfigPage() {
  const { fetchCcConfig, updateCcConfig } = useClinicStore();

  const [percentage, setPercentage] = useState('0');
  const [minAmount, setMinAmount] = useState('0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchCcConfig();
        setPercentage(String(data.percentage ?? 0));
        setMinAmount(String(data.minAmount ?? 0));
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchCcConfig]);

  async function handleSave() {
    const pct = Number(percentage);
    const min = Number(minAmount);
    if (!(pct >= 0)) return toast.error('Percentage sahi daalo');
    if (!(min >= 0)) return toast.error('Min Amount sahi daalo');
    setSaving(true);
    try {
      await updateCcConfig({ percentage: pct, minAmount: min });
      toast.success('Credit Card parameter save ho gaya');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="clinic-parameter-page">
      <ClinicMenuBar />

      <div className="cpp-body">
        <PageHeader
          breadcrumbs={[
            { label: 'Clinic', link: '/clinic-module' },
            { label: 'Parameters' },
            { label: 'Credit Card %' },
          ]}
          title="Credit Card %"
        />

        <div className="cpp-cc-note">
          Jab kisi slip par payment method <strong>CC (Credit Card)</strong> select ho aur slip ka amount
          Min Amount se zyada ya barabar ho, to yahan set kiya hua percentage surcharge ke taur par add ho jayega.
          Agar amount Min Amount se kam ho, to koi percentage nahi lagega.
        </div>

        {loading ? (
          <p className="cpp-empty">Loading...</p>
        ) : (
          <div className="cpp-cc-card">
            <div className="cpp-cc-row">
              <Input
                label="Percentage (%)"
                type="number"
                min="0"
                step="0.01"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
              />
              <Input
                label="Min Amount (Rs.)"
                type="number"
                min="0"
                step="1"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button label="Save" onClick={handleSave} loading={saving} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
