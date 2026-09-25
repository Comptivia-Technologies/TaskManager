import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { gmailService } from '../services/gmailService';

const GmailConnected = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Connecting the mailbox...');

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) {
      setMessage('Google did not return an authorization code.');
      return;
    }

    gmailService.connect(code)
      .then((mailbox) => {
        toast.success(`Connected ${mailbox.email}`);
        navigate('/mailboxes', { replace: true });
      })
      .catch(() => {
        setMessage('Could not connect this mailbox. Confirm the Google redirect URI matches http://localhost:3000/gmail/connected.');
      });
  }, [navigate]);

  return (
    <div className="p-8">
      <PageHeader title="Connect Gmail" subtitle={message} />
      {message.startsWith('Connecting') && <LoadingSpinner />}
    </div>
  );
};

export default GmailConnected;
