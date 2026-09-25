import { useCallback, useEffect, useState } from 'react';
import { FiMail } from 'react-icons/fi';
import { toast } from 'react-toastify';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { gmailService, GmailMailbox } from '../services/gmailService';

const GmailMailboxes = () => {
  const [mailboxes, setMailboxes] = useState<GmailMailbox[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    try {
      setMailboxes(await gmailService.list());
    } catch {
      toast.error('Could not load mailboxes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    const address = email.trim();
    if (!address.includes('@')) {
      toast.error('Enter the Gmail address to connect.');
      return;
    }
    setConnecting(true);
    try {
      window.location.href = await gmailService.authorizeUrl(address);
    } catch {
      toast.error('Gmail OAuth is not configured on TaskService.');
      setConnecting(false);
    }
  };

  const disconnect = async (mailbox: GmailMailbox) => {
    try {
      await gmailService.disconnect(mailbox.mailboxId);
      setMailboxes((current) => current.filter((item) => item.mailboxId !== mailbox.mailboxId));
    } catch {
      toast.error('Could not disconnect that mailbox.');
    }
  };

  return (
    <div className="p-8 lg:p-10">
      <PageHeader
        title="Mailboxes"
        subtitle="Enter the Gmail address, then sign in as that account and allow access."
      />
      <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:items-end max-w-xl">
        <label className="flex-1 block">
          <span className="block text-sm font-semibold text-ink mb-2">Gmail address</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@gmail.com"
            className="w-full px-3 py-2 border border-line rounded-azure-sm bg-surface text-sm"
          />
        </label>
        <Button variant="primary" icon={<FiMail />} loading={connecting} onClick={connect}>Connect Gmail</Button>
      </div>
      {loading ? <LoadingSpinner /> : mailboxes.length === 0 ? (
        <EmptyState
          icon={<FiMail />}
          title="No mailbox connected"
          body="Connect a Gmail account. Mail that arrives there becomes an enquiry."
        />
      ) : (
        <ul className="bg-surface border border-line rounded-azure-sm divide-y divide-line">
          {mailboxes.map((mailbox) => (
            <li key={mailbox.mailboxId} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="font-medium text-ink">{mailbox.email}</p>
                <p className="text-meta text-ink-subtle">Connected {new Date(mailbox.connectedAt).toLocaleString()}</p>
              </div>
              <Button variant="danger" size="sm" onClick={() => disconnect(mailbox)}>Disconnect</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default GmailMailboxes;
