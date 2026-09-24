import { inputClass } from '../utils/formStyles';
import { useEffect, useState } from 'react';
import { FiAlertTriangle } from 'react-icons/fi';
import { teamService } from '../services/teamService';
import { Member } from '../types';

interface StageAssigneePickerProps {
  /** The team that owns the stage being handed to. */
  teamId?: string;
  teamName?: string;
  stageName?: string;
  value: string;
  onChange: (memberId: string) => void;
  /** Raised so callers can block their submit while the team is unstaffed. */
  onBlockedChange?: (blocked: boolean) => void;
  disabled?: boolean;
}

export const AUTO_ASSIGN = '';

const StageAssigneePicker = ({
  teamId,
  teamName,
  stageName,
  value,
  onChange,
  onBlockedChange,
  disabled = false,
}: StageAssigneePickerProps) => {
  const [members, setMembers] = useState<Member[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!teamId) {
      setMembers(null);
      return;
    }
    teamService
      .getMembers(teamId)
      .then((rows) => {
        if (!cancelled) setMembers(rows);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  // An empty team means the handover would strand the work, so callers are told
  // to block rather than discovering it after the fact.
  const blocked = members !== null && members.length === 0;
  useEffect(() => {
    onBlockedChange?.(blocked);
  }, [blocked, onBlockedChange]);

  if (!teamId) return null;

  if (blocked) {
    return (
      <div role="alert" className="flex items-start gap-2.5 px-3 py-2.5 bg-danger-subtle border border-danger-border rounded-control text-body text-danger">
        <FiAlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>
          <strong>{teamName ?? 'That team'}</strong> has no members, so{' '}
          {stageName ? <strong>{stageName}</strong> : 'the next stage'} has nobody to receive this.
          Add someone to the team first.
        </span>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="stage-assignee" className="block text-body font-medium text-ink mb-1.5">
        Hand over to {stageName ? <span className="font-normal text-ink-subtle">· {stageName}</span> : null}
      </label>
      <select
        id="stage-assignee"
        value={value}
        disabled={disabled || members === null}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        <option value={AUTO_ASSIGN}>Auto — least loaded member of {teamName ?? 'the team'}</option>
        {(members ?? []).map((m) => (
          <option key={m.memberId} value={m.memberId}>
            {m.firstName} {m.lastName}
          </option>
        ))}
      </select>
    </div>
  );
};

export default StageAssigneePicker;
