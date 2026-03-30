
export const MOCK_ASSIGNMENTS = [
  {
    id: 'mock-1',
    title: 'Artkey Platform Launch',
    description: 'Finalize the production environment and DNS for the official release.',
    priority: 'High',
    status: 'In Progress',
    due_date: new Date().toISOString().split('T')[0],
    assignee: 'Sofia Reyes',
  },
  {
    id: 'mock-2',
    title: 'Gallery Wall Setup - West Wing',
    description: 'Coordinate with installers for the new exhibition. Ensure the lighting is perfect.',
    priority: 'Medium',
    status: 'Pending',
    due_date: new Date().toISOString().split('T')[0],
    assignee: 'Marcus Lee',
  },
  {
    id: 'mock-3',
    title: 'Digital Artist Onboarding',
    description: 'Send invitations to the top 50 creators on the waiting list.',
    priority: 'Low',
    status: 'Completed',
    due_date: new Date().toISOString().split('T')[0],
    assignee: 'Aria Novak',
  },
];

export const MOCK_HISTORY = {
  'mock-1': [
    { id: 'h1', assignment_id: 'mock-1', action_type: 'status_change', old_value: 'Pending', new_value: 'In Progress', user_name: 'Sofia Reyes', created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 'h2', assignment_id: 'mock-1', action_type: 'Comment added', old_value: null, new_value: 'Initial deployment successful.', user_name: 'System', created_at: new Date(Date.now() - 7200000).toISOString() },
  ],
  'mock-2': [
    { id: 'h3', assignment_id: 'mock-2', action_type: 'Task created', old_value: null, new_value: 'Ready for assignment.', user_name: 'Marcus Lee', created_at: new Date(Date.now() - 86400000).toISOString() },
  ],
  'mock-3': [
    { id: 'h4', assignment_id: 'mock-3', action_type: 'status_change', old_value: 'In Progress', new_value: 'Completed', user_name: 'Aria Novak', created_at: new Date(Date.now() - 1800000).toISOString() },
  ]
};
