// Offline sync state management
export interface OfflineChange {
  id: string;
  type: string;
  entity: string;
  data: any;
  timestamp: string;
  synced: boolean;
}

const OFFLINE_CHANGES_KEY = 'petshield_offline_changes';
const ONLINE_STATUS_KEY = 'petshield_online_status';

export class OfflineManager {
  private changes: OfflineChange[] = [];
  private isOnline: boolean = navigator.onLine;
  private listeners: Set<(status: boolean) => void> = new Set();

  constructor() {
    this.loadChanges();
    this.setupOnlineListener();
  }

  private setupOnlineListener() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners();
    });
  }

  onStatusChange(listener: (status: boolean) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.isOnline));
  }

  private loadChanges() {
    try {
      const stored = localStorage.getItem(OFFLINE_CHANGES_KEY);
      if (stored) {
        this.changes = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load offline changes:', error);
    }
  }

  private saveChanges() {
    try {
      localStorage.setItem(OFFLINE_CHANGES_KEY, JSON.stringify(this.changes));
    } catch (error) {
      console.error('Failed to save offline changes:', error);
    }
  }

  addChange(type: string, entity: string, data: any) {
    const change: OfflineChange = {
      id: `offline-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type,
      entity,
      data,
      timestamp: new Date().toISOString(),
      synced: false,
    };

    this.changes.push(change);
    this.saveChanges();
    return change;
  }

  getPendingChanges() {
    return this.changes.filter(c => !c.synced);
  }

  getPendingCount() {
    return this.getPendingChanges().length;
  }

  markAsSynced(changeId: string) {
    const change = this.changes.find(c => c.id === changeId);
    if (change) {
      change.synced = true;
      this.saveChanges();
    }
  }

  clearSynced() {
    this.changes = this.changes.filter(c => !c.synced);
    this.saveChanges();
  }

  isOnlineStatus() {
    return this.isOnline;
  }
}

export const offlineManager = new OfflineManager();
