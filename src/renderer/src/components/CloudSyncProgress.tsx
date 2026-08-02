import { Cloud } from 'lucide-react';
import './CloudSyncProgress.css';

interface CloudSyncProgressProps {
  progress: number;
  visible: boolean;
  message?: string;
}

export function CloudSyncProgress({ progress, visible, message }: CloudSyncProgressProps) {
  if (!visible) return null;

  return (
    <div className="cloud-sync-progress">
      <div className="cloud-sync-progress-content">
        <Cloud size={16} />
        <div className="cloud-sync-progress-bar-container">
          <div className="cloud-sync-progress-bar">
            <div
              className="cloud-sync-progress-bar-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
        <span className="cloud-sync-progress-text">{Math.round(progress)}%</span>
      </div>
      {message && <div className="cloud-sync-progress-message">{message}</div>}
    </div>
  );
}

