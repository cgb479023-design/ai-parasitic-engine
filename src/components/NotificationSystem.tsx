// Notification System Component

import React, { createContext, ReactNode, useContext } from 'react';

interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface NotificationContextType {
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationSystemProps {
  notifications: Notification[];
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({ notifications }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col space-y-3">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
        />
      ))}
    </div>
  );
};

interface NotificationItemProps {
  notification: Notification;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification }) => {
  const { id, message, type } = notification;

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          bgColor: 'bg-green-600',
          textColor: 'text-white',
          icon: '✓',
          borderColor: 'border-green-700'
        };
      case 'error':
        return {
          bgColor: 'bg-red-600',
          textColor: 'text-white',
          icon: '✗',
          borderColor: 'border-red-700'
        };
      case 'info':
      default:
        return {
          bgColor: 'bg-blue-600',
          textColor: 'text-white',
          icon: 'ℹ',
          borderColor: 'border-blue-700'
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg shadow-lg border transition-all duration-300 transform animate-in slide-in-from-right-8 fade-in-50 ${styles.bgColor} ${styles.textColor} ${styles.borderColor} max-w-sm`}
    >
      <div className="flex items-center space-x-3">
        <div className="text-lg font-bold">{styles.icon}</div>
        <div className="text-sm font-medium">{message}</div>
      </div>
    </div>
  );
};

// Custom Hook for using Notification Context
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationContext.Provider');
  }
  return context;
};
