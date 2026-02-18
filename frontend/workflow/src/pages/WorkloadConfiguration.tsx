import { useState, useEffect, useCallback } from 'react';
import { useMembers } from '../hooks/useMembers';
import { workloadService } from '../services/workloadService';
import { WorkloadResponse } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { FiRefreshCw, FiSearch, FiCheckCircle, FiAlertCircle, FiXCircle, FiClock, FiEye, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';

const WorkloadConfiguration = () => {
  const { members, loading: membersLoading } = useMembers();
  const [workloads, setWorkloads] = useState<Map<string, WorkloadResponse>>(new Map());
  const [loadingWorkloads, setLoadingWorkloads] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadAllWorkloads = useCallback(async () => {
    setRefreshing(true);
    const newWorkloads = new Map<string, WorkloadResponse>();
    const loadingSet = new Set<string>();

    for (const member of members) {
      loadingSet.add(member.memberId);
      try {
        const workload = await workloadService.getByMemberId(member.memberId);
        newWorkloads.set(member.memberId, workload);
      } catch (error: any) {
        console.error(`Failed to load workload for member ${member.memberId}:`, error);
        toast.error(`Failed to load workload for ${member.firstName} ${member.lastName}`);
      } finally {
        loadingSet.delete(member.memberId);
      }
    }

    setWorkloads(newWorkloads);
    setLoadingWorkloads(loadingSet);
    setRefreshing(false);
  }, [members]);

  useEffect(() => {
    if (members.length > 0) {
      loadAllWorkloads();
    }
  }, [members, loadAllWorkloads]);


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'PartiallyLoaded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'FullyLoaded':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Overloaded':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Available':
        return <FiCheckCircle className="text-green-600" />;
      case 'PartiallyLoaded':
        return <FiAlertCircle className="text-yellow-600" />;
      case 'FullyLoaded':
        return <FiAlertCircle className="text-orange-600" />;
      case 'Overloaded':
        return <FiXCircle className="text-red-600" />;
      default:
        return <FiClock className="text-gray-600" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 30) return 'text-green-600';
    if (score < 60) return 'text-yellow-600';
    if (score < 85) return 'text-orange-600';
    return 'text-red-600';
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.teamName && member.teamName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const handleOpenModal = (memberId: string) => {
    setSelectedMemberId(memberId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMemberId(null);
  };

  const selectedWorkload = selectedMemberId ? workloads.get(selectedMemberId) : null;
  const selectedMember = selectedMemberId ? members.find(m => m.memberId === selectedMemberId) : null;

  if (membersLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-8 bg-white font-sans">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#434E78]/20">
        <div>
          <h1 className="text-3xl font-semibold text-black font-sans tracking-tight">
            Workload Configuration
          </h1>
          <p className="text-sm text-black/60 mt-1 font-sans">
            Monitor and manage team member workload and availability
          </p>
        </div>
        <button
          onClick={loadAllWorkloads}
          disabled={refreshing}
          className="bg-[#434E78] text-white px-5 py-2.5 rounded-azure-sm hover:bg-[#434E78]/90 flex items-center shadow-azure-sm hover:shadow-azure-md transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiRefreshCw className={`mr-2 text-base ${refreshing ? 'animate-spin' : ''}`} />
          Refresh All
        </button>
      </div>

      {/* Workload Status Legend */}
      {filteredMembers.length > 0 && (
        <div className="mb-6 p-4 bg-[#434E78]/5 rounded-azure-sm border border-[#434E78]/20">
          <h3 className="text-sm font-semibold text-black mb-3 font-sans">Workload Status Legend</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-sans">
            <div className="flex items-center">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200 mr-2">
                <FiCheckCircle className="mr-1.5 text-green-600" />
                Available
              </span>
              <span className="text-black/60">Score &lt; 30</span>
            </div>
            <div className="flex items-center">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200 mr-2">
                <FiAlertCircle className="mr-1.5 text-yellow-600" />
                Partially Loaded
              </span>
              <span className="text-black/60">Score 30-60</span>
            </div>
            <div className="flex items-center">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200 mr-2">
                <FiAlertCircle className="mr-1.5 text-orange-600" />
                Fully Loaded
              </span>
              <span className="text-black/60">Score 60-85</span>
            </div>
            <div className="flex items-center">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200 mr-2">
                <FiXCircle className="mr-1.5 text-red-600" />
                Overloaded
              </span>
              <span className="text-black/60">Score ≥ 85</span>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="relative w-full md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="text-[#434E78] text-base" />
          </div>
          <input
            type="text"
            placeholder="Search members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm font-sans"
          />
        </div>
      </div>

      <div className="bg-white rounded-azure-sm shadow-azure-sm overflow-hidden border border-[#434E78]/20">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#434E78]/20">
            <thead className="bg-[#434E78]/5">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                  Team
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                  Workload Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                  Efficiency
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                  Skill Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider font-sans">
                  Tasks
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[#434E78]/20">
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-black/60 font-sans">
                  No members found
                </td>
              </tr>
              ) : (
                filteredMembers.map((member) => {
                  const workload = workloads.get(member.memberId);
                  const isLoading = loadingWorkloads.has(member.memberId);

                  return (
                    <tr key={member.memberId} className="hover:bg-[#434E78]/5 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-semibold text-black font-sans">
                            {member.firstName} {member.lastName}
                          </div>
                          <div className="text-sm text-black/60 font-sans">{member.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-black/70 font-sans">
                        {member.teamName || 'Unassigned'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isLoading ? (
                          <div className="flex items-center text-black/60">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#434E78]"></div>
                            <span className="ml-2 text-sm">Loading...</span>
                          </div>
                        ) : workload ? (
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                              workload.workloadStatus
                            )}`}
                          >
                            <span className="mr-1.5">{getStatusIcon(workload.workloadStatus)}</span>
                            {workload.workloadStatus}
                          </span>
                        ) : (
                          <span className="text-black/40 text-sm">Not calculated</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {workload ? (
                          <div className="flex items-center">
                            <span className={`text-lg font-bold ${getScoreColor(workload.workloadScore)}`}>
                              {workload.workloadScore.toFixed(1)}
                            </span>
                            <span className="text-black/40 text-sm ml-1">/ 100</span>
                          </div>
                        ) : (
                          <span className="text-black/40 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-black/70 font-sans">
                        {workload ? (
                          <div>
                            <span className="font-medium">{(workload.metrics.efficiency * 100).toFixed(1)}%</span>
                            <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                              <div
                                className="bg-[#434E78] h-2 rounded-full"
                                style={{ width: `${workload.metrics.efficiency * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-black/40 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-black/70 font-sans">
                        {workload ? (
                          <div className="flex items-center">
                            <span className="font-medium">{workload.metrics.skillLevel}</span>
                            <span className="text-black/40 text-sm ml-1">/ 5</span>
                            <div className="ml-2 flex">
                              {[...Array(5)].map((_, i) => (
                                <div
                                  key={i}
                                  className={`w-2 h-2 rounded-full mr-0.5 ${
                                    i < workload.metrics.skillLevel ? 'bg-[#434E78]' : 'bg-gray-200'
                                  }`}
                                ></div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-black/40 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-black/70 font-sans">
                        {workload ? (
                          <button
                            onClick={() => handleOpenModal(member.memberId)}
                            className="flex items-center justify-center w-8 h-8 rounded-azure-sm hover:bg-[#434E78]/10 text-[#434E78] hover:text-[#434E78]/80 transition-colors"
                            title="View task counts"
                          >
                            <FiEye className="text-lg" />
                          </button>
                        ) : (
                          <span className="text-black/40 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task Counts Modal */}
      {isModalOpen && selectedWorkload && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-azure-sm shadow-azure-xl p-6 w-full max-w-md border border-[#434E78]/20">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-black font-sans">
                Task Counts - {selectedMember.firstName} {selectedMember.lastName}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-black/70 hover:text-black hover:bg-[#434E78]/10 p-1 rounded-azure-sm transition-colors"
              >
                <FiX className="text-lg" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-[#434E78]/10">
                <span className="text-black/70 font-sans">Active</span>
                <span className="font-semibold text-black font-sans">{selectedWorkload.metrics.activeTaskCount}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#434E78]/10">
                <span className="text-black/70 font-sans">Pending</span>
                <span className="font-semibold text-black font-sans">{selectedWorkload.metrics.pendingTaskCount}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#434E78]/10">
                <span className="text-black/70 font-sans">Completed</span>
                <span className="font-semibold text-black font-sans">{selectedWorkload.metrics.completedTaskCount}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#434E78]/10">
                <span className="text-black/70 font-sans">Escalated</span>
                <span className="font-semibold text-orange-600 font-sans">{selectedWorkload.metrics.escalatedTaskCount}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#434E78]/10">
                <span className="text-black/70 font-sans">Overdue</span>
                <span className="font-semibold text-red-600 font-sans">{selectedWorkload.metrics.overdueTaskCount}</span>
              </div>
              <div className="flex items-center justify-between py-2 pt-3">
                <span className="text-black/60 font-sans text-sm">Total</span>
                <span className="font-semibold text-black font-sans">{selectedWorkload.metrics.totalTaskCount}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-[#434E78] text-white rounded-azure-sm hover:bg-[#434E78]/90 font-medium text-sm shadow-azure-sm transition-colors font-sans"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkloadConfiguration;

