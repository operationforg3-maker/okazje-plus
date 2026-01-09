/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('@/lib/firebase', () => ({ db: {}, functions: {}, auth: { currentUser: null } }));
jest.mock('react-firebase-hooks/firestore', () => ({ useCollection: () => [null] }));

import { AutopilotCard, AutopilotProfile } from '../aliexpress-importer';

const profiles: AutopilotProfile[] = [
  { id: 'p1', name: 'Profile 1', enabled: true, maxItemsPerRun: 10 },
  { id: 'p2', name: 'Profile 2', enabled: false, maxItemsPerRun: 20 },
];

describe('AutopilotCard', () => {
  it('renders profiles and triggers callbacks', () => {
    const onToggle = jest.fn();
    const onRunProfile = jest.fn();
    const onRunAll = jest.fn();

    render(
      <AutopilotCard
        profiles={profiles}
        loading={false}
        running={false}
        message={null}
        onToggle={onToggle}
        onRunProfile={onRunProfile}
        onRunAll={onRunAll}
      />
    );

    expect(screen.getByText('Profile 1')).toBeInTheDocument();
    expect(screen.getByText('Profile 2')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toggle-p2'));
    expect(onToggle).toHaveBeenCalledWith('p2', true);

    fireEvent.click(screen.getByTestId('run-p1'));
    expect(onRunProfile).toHaveBeenCalledWith('p1', 10);

    fireEvent.click(screen.getByText('Uruchom autopilota teraz'));
    expect(onRunAll).toHaveBeenCalled();
  });
});
