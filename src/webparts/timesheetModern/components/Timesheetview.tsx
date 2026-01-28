import * as React from 'react';
import styles from './TimesheetModern.module.scss';

export interface ITimesheetViewProps {
  onViewChange: (viewName: string) => void;
}

interface ITimesheetEntry {
  id: number;
  date: string;
  project: string;
  hours: number;
  taskType: string;
  description: string;
}

const TimesheetView: React.FC<ITimesheetViewProps> = (props) => {
  const { onViewChange } = props;

  // State management
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  const [entries, setEntries] = React.useState<ITimesheetEntry[]>([
    {
      id: 1,
      date: '2025-01-20',
      project: 'Project Alpha',
      hours: 3.5,
      taskType: 'Development',
      description: 'Implemented user authentication module with React hooks'
    },
    {
      id: 2,
      date: '2025-01-20',
      project: 'Project Beta',
      hours: 2.0,
      taskType: 'Meeting',
      description: 'Weekly sprint planning and team sync'
    }
  ]);
  const [editingEntry, setEditingEntry] = React.useState<ITimesheetEntry | null>(null);
  
  // Form state
  const [formData, setFormData] = React.useState({
    date: '2025-01-20',
    project: '',
    hours: 0,
    taskType: 'Development',
    description: ''
  });

  // Open modal for new entry
  const handleAddEntry = (date?: string): void => {
    setEditingEntry(null);
    setFormData({
      date: date || '2025-01-20',
      project: '',
      hours: 0,
      taskType: 'Development',
      description: ''
    });
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleEditEntry = (entry: ITimesheetEntry): void => {
    setEditingEntry(entry);
    setFormData({
      date: entry.date,
      project: entry.project,
      hours: entry.hours,
      taskType: entry.taskType,
      description: entry.description
    });
    setIsModalOpen(true);
  };

  // Close modal
  const handleCloseModal = (): void => {
    setIsModalOpen(false);
    setEditingEntry(null);
    setFormData({
      date: '2025-01-20',
      project: '',
      hours: 0,
      taskType: 'Development',
      description: ''
    });
  };

  // Form input change
  const handleInputChange = (field: string, value: any): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Submit form
  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    
    if (editingEntry) {
      // Update existing entry
      setEntries(prev => prev.map(entry => 
        entry.id === editingEntry.id 
          ? { ...entry, ...formData }
          : entry
      ));
      alert(`Timesheet entry updated: ${formData.hours} hours for ${formData.project}`);
    } else {
      // Add new entry
      const newEntry: ITimesheetEntry = {
        id: Date.now(),
        ...formData
      };
      setEntries(prev => [...prev, newEntry]);
      alert(`Timesheet entry added: ${formData.hours} hours for ${formData.project}`);
    }
    
    handleCloseModal();
  };

  // Delete entry
  const handleDeleteEntry = (entryId: number): void => {
    if (confirm('Are you sure you want to delete this timesheet entry?')) {
      const deletedEntry = entries.find(e => e.id === entryId);
      setEntries(prev => prev.filter(e => e.id !== entryId));
      if (deletedEntry) {
        alert(`Timesheet entry deleted: ${deletedEntry.hours} hours for ${deletedEntry.project}`);
      }
    }
  };

  // Submit timesheet
  const handleSubmitTimesheet = (): void => {
    if (entries.length === 0) {
      alert('Please add at least one timesheet entry before submitting.');
      return;
    }
    
    const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
    
    if (confirm(`Submit timesheet for approval?\n\nTotal Hours: ${totalHours.toFixed(1)}\nEntries: ${entries.length}\n\nYour timesheet will be sent for approval.`)) {
      alert(`Timesheet submitted successfully!\n\nTotal Hours: ${totalHours.toFixed(1)}\nEntries: ${entries.length}\n\nYour timesheet has been sent for approval.`);
    }
  };

  // Calculate totals
  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const daysWithEntries = new Set(entries.map(e => e.date)).size;

  return (
    <div className={styles.viewContainer}>
      <div className={styles.dashboardHeader}>
        <h1>Timesheet Entries</h1>
        <p>Log your daily work hours and project allocations</p>
      </div>
      
      <div className={styles.timesheetContainer}>
        {/* Week Navigation */}
        <div className={styles.weekNavigation}>
          <button className={styles.weekNavBtn}>← Previous Week</button>
          <div className={styles.weekDisplay}>Week of Jan 20-26, 2025</div>
          <button className={styles.weekNavBtn}>Next Week →</button>
        </div>
        
        <div className={styles.timesheetHeader}>
          <div>
            <h3>Week of Jan 20-26, 2025</h3>
            <p>Log hours worked on each project daily (Max 9 hours per day)</p>
          </div>
          <div className={styles.timesheetActions}>
            <div className={styles.availableHoursDisplay}>
              <span>Available Hours:</span>
              <span>9</span>/9
            </div>
            <button 
              className={`${styles.btn} ${styles.btnPurple}`}
              onClick={() => handleAddEntry()}
            >
              + Add Entry
            </button>
          </div>
        </div>
        
        {/* Timesheet Grid */}
        <div className={styles.timesheetGrid}>
          {/* Monday - Today with entries */}
          <div className={`${styles.timesheetDay} ${styles.todayHighlight}`}>
            <div className={styles.timesheetDayHeader}>
              <div className={styles.dayInfo}>
                <div className={styles.dayDate}>Mon, Jan 20 (Today) (Present)</div>
                <span className={`${styles.dayStatusBadge} ${styles.pending}`}>Pending</span>
              </div>
              <div className={styles.dayTotal}>{totalHours.toFixed(1)}h / 7.0h</div>
            </div>
            
            <div className={styles.timesheetEntries}>
              {entries.filter(e => e.date === '2025-01-20').map(entry => (
                <div key={entry.id} className={styles.timesheetEntry}>
                  <div className={styles.entryHeader}>
                    <div className={styles.projectName}>{entry.project}</div>
                    <div className={styles.entryHours}>{entry.hours}h</div>
                  </div>
                  <div className={styles.entryDescription}>
                    {entry.description}
                  </div>
                  <div className={styles.entryActions}>
                    <button 
                      className={`${styles.entryActionBtn} ${styles.editBtn}`}
                      onClick={() => handleEditEntry(entry)}
                    >
                      <span>✏️</span> Edit
                    </button>
                    <button 
                      className={`${styles.entryActionBtn} ${styles.deleteBtn}`}
                      onClick={() => handleDeleteEntry(entry.id)}
                    >
                      <span>🗑️</span> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <button 
              className={styles.addEntryBtn}
              onClick={() => handleAddEntry('2025-01-20')}
            >
              + Add Entry for Mon, Jan 20 ({(7.0 - totalHours).toFixed(1)}h available)
            </button>
          </div>
          
          {/* Tuesday - No entries */}
          <div className={styles.timesheetDay}>
            <div className={styles.timesheetDayHeader}>
              <div className={styles.dayInfo}>
                <div className={styles.dayDate}>Tue, Jan 21 (Present)</div>
                <span className={`${styles.dayStatusBadge} ${styles.pending}`}>Pending</span>
              </div>
              <div className={styles.dayTotal}>0.0h / 8.0h</div>
            </div>
            
            <div className={styles.timesheetEntries}></div>
            
            <button 
              className={styles.addEntryBtn}
              onClick={() => handleAddEntry('2025-01-21')}
            >
              + Add Entry for Tue, Jan 21 (8.0h available)
            </button>
          </div>

          {/* Wednesday - No entries */}
          <div className={styles.timesheetDay}>
            <div className={styles.timesheetDayHeader}>
              <div className={styles.dayInfo}>
                <div className={styles.dayDate}>Wed, Jan 22 (Present)</div>
                <span className={`${styles.dayStatusBadge} ${styles.pending}`}>Pending</span>
              </div>
              <div className={styles.dayTotal}>0.0h / 8.0h</div>
            </div>
            
            <div className={styles.timesheetEntries}></div>
            
            <button 
              className={styles.addEntryBtn}
              onClick={() => handleAddEntry('2025-01-22')}
            >
              + Add Entry for Wed, Jan 22 (8.0h available)
            </button>
          </div>
        </div>

        {/* Submit Timesheet Button */}
        <button 
          className={styles.submitTimesheetBtn}
          onClick={handleSubmitTimesheet}
        >
          <span>✓</span> Submit Timesheet
        </button>
      </div>
      
      <div className={styles.timesheetSummary}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryValue}>{totalHours.toFixed(1)}</div>
          <div className={styles.summaryLabel}>Total Hours</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryValue}>{daysWithEntries}/7</div>
          <div className={styles.summaryLabel}>Days Submitted</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryValue}>{totalHours.toFixed(1)}</div>
          <div className={styles.summaryLabel}>Project Hours</div>
        </div>
      </div>

      {/* Modal for Add/Edit Entry */}
      {isModalOpen && (
        <div className={styles.modal} style={{ display: 'flex' }}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>{editingEntry ? 'Edit Timesheet Entry' : 'Add Timesheet Entry'}</h3>
              <button className={styles.closeBtn} onClick={handleCloseModal}>×</button>
            </div>
            
            <form className={styles.timesheetForm} onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Date *</label>
                <input 
                  type="date" 
                  className={styles.formInput}
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Project *</label>
                <select 
                  className={styles.formSelect}
                  value={formData.project}
                  onChange={(e) => handleInputChange('project', e.target.value)}
                  required
                >
                  <option value="">Select Project...</option>
                  <option value="Project Alpha">Project Alpha</option>
                  <option value="Project Beta">Project Beta</option>
                  <option value="Project Gamma">Project Gamma</option>
                  <option value="Project Delta">Project Delta</option>
                  <option value="Internal">Internal</option>
                </select>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Hours * (Max 9 per day)</label>
                  <input 
                    type="number" 
                    className={styles.formInput}
                    min="0.5"
                    max="9"
                    step="0.5"
                    placeholder="0.0"
                    value={formData.hours || ''}
                    onChange={(e) => handleInputChange('hours', parseFloat(e.target.value))}
                    required
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Task Type</label>
                  <select 
                    className={styles.formSelect}
                    value={formData.taskType}
                    onChange={(e) => handleInputChange('taskType', e.target.value)}
                  >
                    <option value="Development">Development</option>
                    <option value="Testing">Testing</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Planning">Planning</option>
                    <option value="Documentation">Documentation</option>
                  </select>
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description *</label>
                <textarea 
                  className={styles.formTextarea}
                  placeholder="Describe the work you did..."
                  rows={3}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  required
                ></textarea>
              </div>
              
              <div className={styles.formActions}>
                <button 
                  type="button" 
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  {editingEntry ? 'Update Entry' : 'Add Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimesheetView;