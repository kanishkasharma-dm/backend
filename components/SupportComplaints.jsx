import React, { useState, useEffect } from 'react';

const SupportComplaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const getAdminToken = () => {
    return localStorage.getItem('adminToken');
  };

  const fetchComplaints = async (status = 'all') => {
    try {
      setLoading(true);
      setError('');
      
      const token = getAdminToken();
      if (!token) {
        setError('Admin authentication required');
        setLoading(false);
        return;
      }

      const apiUrl = import.meta.env.VITE_API_URL || '';
      let url = `${apiUrl}/support/complaints`;
      
      if (status !== 'all') {
        url += `?status=${status}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication expired. Please login again.');
          localStorage.removeItem('adminToken');
        } else {
          setError('Failed to fetch complaints');
        }
        return;
      }

      const data = await response.json();
      if (data.success) {
        setComplaints(data.complaints || []);
        setFilteredComplaints(data.complaints || []);
      } else {
        setError(data.error?.message || 'Failed to fetch complaints');
      }
    } catch (err) {
      console.error('Error fetching complaints:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateComplaint = async (complaintId, status, notes) => {
    try {
      setUpdating(true);
      
      const token = getAdminToken();
      if (!token) {
        setError('Admin authentication required');
        return;
      }

      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/support/complaint/${complaintId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          complaint_id: complaintId,
          status,
          admin_notes: notes,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication expired. Please login again.');
          localStorage.removeItem('adminToken');
        } else {
          setError('Failed to update complaint');
        }
        return;
      }

      const data = await response.json();
      if (data.success) {
        // Update local state
        setComplaints(prev => 
          prev.map(complaint => 
            complaint.complaint_id === complaintId 
              ? data.complaint 
              : complaint
          )
        );
        setFilteredComplaints(prev => 
          prev.map(complaint => 
            complaint.complaint_id === complaintId 
              ? data.complaint 
              : complaint
          )
        );
        
        // Close modal and reset form
        setShowModal(false);
        setSelectedComplaint(null);
        setAdminNotes('');
      } else {
        setError(data.error?.message || 'Failed to update complaint');
      }
    } catch (err) {
      console.error('Error updating complaint:', err);
      setError('Network error. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    fetchComplaints(status);
  };

  const openComplaintModal = (complaint) => {
    setSelectedComplaint(complaint);
    setAdminNotes(complaint.admin_notes || '');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedComplaint(null);
    setAdminNotes('');
  };

  const handleMarkResolved = () => {
    if (selectedComplaint) {
      updateComplaint(selectedComplaint.complaint_id, 'resolved', adminNotes);
    }
  };

  const handleUpdateNotes = () => {
    if (selectedComplaint) {
      updateComplaint(selectedComplaint.complaint_id, selectedComplaint.status, adminNotes);
    }
  };

  const getStatusBadge = (status) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    if (status === 'open') {
      return `${baseClasses} bg-red-900 text-red-200`;
    } else if (status === 'resolved') {
      return `${baseClasses} bg-green-900 text-green-200`;
    }
    return `${baseClasses} bg-gray-700 text-gray-300`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  useEffect(() => {
    fetchComplaints(statusFilter);
  }, []);

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Support Complaints</h1>
          <p className="text-gray-400">Manage and resolve customer support complaints</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900 border border-red-700 rounded-lg">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        <div className="mb-6">
          <div className="flex space-x-2">
            <button
              onClick={() => handleStatusFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All
            </button>
            <button
              onClick={() => handleStatusFilter('open')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'open'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Open
            </button>
            <button
              onClick={() => handleStatusFilter('resolved')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'resolved'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Resolved
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-400">Loading complaints...</div>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">
              {statusFilter === 'all' 
                ? 'No complaints found' 
                : `No ${statusFilter} complaints found`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-gray-800 rounded-lg overflow-hidden">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Machine ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Complaint
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredComplaints.map((complaint) => (
                  <tr key={complaint.complaint_id} className="hover:bg-gray-750">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatDate(complaint.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {complaint.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {complaint.machine_id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300 max-w-xs truncate">
                      {complaint.complaint}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <span className="capitalize">{complaint.source}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(complaint.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => openComplaintModal(complaint)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                      >
                        View & Resolve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal */}
        {showModal && selectedComplaint && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-white">Complaint Details</h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
                    <p className="text-white">{formatDate(selectedComplaint.created_at)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                    <div>{getStatusBadge(selectedComplaint.status)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                    <p className="text-white">{selectedComplaint.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Machine ID</label>
                    <p className="text-white">{selectedComplaint.machine_id}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Source</label>
                  <p className="text-white capitalize">{selectedComplaint.source}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Complaint</label>
                  <p className="text-white bg-gray-700 p-3 rounded">{selectedComplaint.complaint}</p>
                </div>

                {selectedComplaint.resolved_at && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Resolved At</label>
                    <p className="text-white">{formatDate(selectedComplaint.resolved_at)}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Admin Notes</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full bg-gray-700 text-white p-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    rows={4}
                    placeholder="Add admin notes..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleUpdateNotes}
                    disabled={updating}
                    className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 text-white px-4 py-2 rounded font-medium transition-colors"
                  >
                    {updating ? 'Updating...' : 'Update Notes'}
                  </button>
                  
                  {selectedComplaint.status === 'open' && (
                    <button
                      onClick={handleMarkResolved}
                      disabled={updating}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-800 text-white px-4 py-2 rounded font-medium transition-colors"
                    >
                      {updating ? 'Updating...' : 'Mark as Resolved'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportComplaints;
