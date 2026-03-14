"use client";

import Modal from "./Modal";

type Props = {
  open: boolean;
  title: string;
  value: string;
  formula: string;
  onClose: () => void;
};

export default function AccountMetricModal({ open, title, value, formula, onClose }: Props) {
  if (!open) return null;

  return (
    <Modal open onClose={onClose} title={title} className="account-metric-modal">
      <div className="eb-total">
        <span className="etv neutral">{value}</span>
      </div>
      <div className="ef">
        <code>{formula}</code>
      </div>
    </Modal>
  );
}
