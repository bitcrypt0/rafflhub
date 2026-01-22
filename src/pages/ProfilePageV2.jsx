import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Ticket,
  Trophy,
  DollarSign,
  Plus,
  Clock,
  Users,
  Settings,
  CircleDot,
  Eye,
  Trash2,
  Gift,
  Crown,
  RefreshCw,
  ChevronRight,
  Loader2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'
import { useWallet } from '../contexts/WalletContext'
import { useContract } from '../contexts/ContractContext'
import { ethers } from 'ethers'
import { SUPPORTED_NETWORKS } from '../networks'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog'
import { toast } from '../components/ui/sonner'
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints'
import { useProfileData } from '../hooks/useProfileData'
import { useNativeCurrency } from '../hooks/useNativeCurrency'
import { useWinnerCount } from '../hooks/useWinnerCount'
import { ProfileHeader, AnimatedStatCard, StatCardGrid, ActivityTimeline } from '../components/profile'
import NewMobileProfilePage from './mobile/NewMobileProfilePage'

/**
 * ProfilePageV2 - Redesigned profile dashboard with modern UX
 */
const ProfilePageV2 = () => {
  const { isMobile, isInitialized } = useMobileBreakpoints()

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, monospace' }}>
            Dropr
          </div>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  if (isMobile) {
    return <NewMobileProfilePage />
  }

  return <DesktopProfilePageV2 />
}

/**
 * RaffleManagementCard - Enhanced card for created raffles
 */
const RaffleManagementCard = ({ raffle, onDelete, onViewRevenue, onNavigate }) => {
  const { winnerCount } = useWinnerCount(raffle.address)
  const { getCurrencySymbol } = useNativeCurrency()
  const [timeRemaining, setTimeRemaining] = useState('')

  useEffect(() => {
    let interval
    function updateTimer() {
      const now = Math.floor(Date.now() / 1000)
      let targetTime

      if (raffle.state === 'pending') {
        targetTime = raffle.startTime
        const remaining = targetTime - now
        if (remaining > 0) {
          setTimeRemaining(formatTime(remaining))
        } else {
          targetTime = raffle.startTime + raffle.duration
          const remainingToEnd = targetTime - now
          if (remainingToEnd > 0) {
            setTimeRemaining(formatTime(remainingToEnd))
          } else {
            setTimeRemaining('Ended')
          }
        }
      } else if (raffle.state === 'active') {
        targetTime = raffle.startTime + raffle.duration
        const remaining = targetTime - now
        if (remaining > 0) {
          setTimeRemaining(formatTime(remaining))
        } else {
          setTimeRemaining('Ended')
        }
      } else {
        setTimeRemaining('Ended')
      }
    }

    function formatTime(seconds) {
      const days = Math.floor(seconds / 86400)
      const hours = Math.floor((seconds % 86400) / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      if (days > 0) return `${days}d ${hours}h`
      if (hours > 0) return `${hours}h ${minutes}m`
      return `${minutes}m`
    }

    updateTimer()
    interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [raffle])

  const getStatusBadge = () => {
    const statusStyles = {
      pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      active: 'bg-green-500/10 text-green-500 border-green-500/20',
      ended: 'bg-red-500/10 text-red-500 border-red-500/20',
      drawing: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      completed: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      deleted: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
      allPrizesClaimed: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      unengaged: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    }

    const label = raffle.state === 'allPrizesClaimed'
      ? (winnerCount === 1 ? 'Prize Claimed' : 'Prizes Claimed')
      : raffle.state.charAt(0).toUpperCase() + raffle.state.slice(1)

    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusStyles[raffle.state] || statusStyles.deleted}`}>
        {label}
      </span>
    )
  }

  const canDelete = raffle.state === 'pending' || raffle.state === 'active'
  const progress = raffle.slotLimit > 0 ? (raffle.ticketsSold / raffle.slotLimit) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card variant="elevated" className="overflow-hidden">
        {/* Progress bar at top */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{raffle.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge()}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeRemaining}
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Slots Sold</p>
              <p className="text-lg font-semibold">{raffle.ticketsSold} / {raffle.slotLimit}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="text-lg font-semibold">{ethers.utils.formatEther(raffle.totalRevenue || '0')} {getCurrencySymbol()}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              onClick={() => onNavigate(raffle)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onViewRevenue(raffle)}
              disabled={!raffle.totalRevenue || parseFloat(ethers.utils.formatEther(raffle.totalRevenue)) <= 0}
            >
              <DollarSign className="h-4 w-4" />
            </Button>
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(raffle)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * PurchasedSlotCard - Card for purchased raffle slots
 */
const PurchasedSlotCard = ({ ticket, onClaimPrize, onClaimRefund, onNavigate }) => {
  const { winnerCount } = useWinnerCount(ticket.raffleAddress)
  const { getCurrencySymbol } = useNativeCurrency()

  const canClaimPrize = ticket.isWinner &&
    (ticket.raffleState === 'Completed' || ticket.raffleState === 'AllPrizesClaimed') &&
    !ticket.prizeClaimed

  const canClaimRefund = !ticket.isWinner &&
    (ticket.raffleState === 'Completed' || ticket.raffleState === 'AllPrizesClaimed') &&
    !ticket.refundClaimed

  const getStateDisplay = () => {
    if (ticket.raffleState === 'allPrizesClaimed' && typeof winnerCount === 'number') {
      return winnerCount === 1 ? 'Prize Claimed' : 'Prizes Claimed'
    }
    return ticket.raffleState.charAt(0).toUpperCase() + ticket.raffleState.slice(1)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card variant="elevated" className="overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{ticket.raffleName}</h3>
              <p className="text-sm text-muted-foreground">{ticket.quantity} slot{ticket.quantity > 1 ? 's' : ''}</p>
            </div>
            {ticket.isWinner && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-medium">
                <Crown className="h-3 w-3" />
                Winner
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Cost</span>
              <span className="font-medium">{ethers.utils.formatEther(ticket.totalCost)} {getCurrencySymbol()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{getStateDisplay()}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => onNavigate(ticket)}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              View Raffle
            </Button>
            {canClaimPrize && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onClaimPrize(ticket)}
              >
                <Gift className="h-4 w-4 mr-1" />
                Claim Prize
              </Button>
            )}
            {canClaimRefund && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onClaimRefund(ticket)}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Claim Refund
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * DesktopProfilePageV2 - Main desktop implementation
 */
const DesktopProfilePageV2 = () => {
  const { connected, address, chainId } = useWallet()
  const { getContractInstance, executeTransaction } = useContract()
  const navigate = useNavigate()
  const { getCurrencySymbol } = useNativeCurrency()
  const [activeTab, setActiveTab] = useState('activity')
  const [showRevenueModal, setShowRevenueModal] = useState(false)
  const [selectedRaffle, setSelectedRaffle] = useState(null)

  const {
    userActivity,
    createdRaffles,
    purchasedTickets,
    activityStats,
    creatorStats,
    loading,
    fetchCreatedRaffles,
    fetchPurchasedTickets,
  } = useProfileData()

  // Transform activities for timeline
  const transformedActivities = useMemo(() => {
    return userActivity.map(activity => ({
      ...activity,
      title: getActivityTitle(activity, getCurrencySymbol),
      description: getActivityDescription(activity, getCurrencySymbol),
    }))
  }, [userActivity, getCurrencySymbol])

  // Get chain info
  const chainInfo = chainId ? SUPPORTED_NETWORKS[chainId] : null

  // Navigation helper
  const handleNavigateToRaffle = (item) => {
    const raffleAddress = item.raffleAddress || item.address
    const itemChainId = item.chainId
    const slug = itemChainId && SUPPORTED_NETWORKS[itemChainId]
      ? SUPPORTED_NETWORKS[itemChainId].name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : ''
    const path = slug ? `/${slug}/raffle/${raffleAddress}` : `/raffle/${raffleAddress}`
    navigate(path)
  }

  // Handlers
  const handleDeleteRaffle = async (raffle) => {
    let confirmMessage = `Are you sure you want to delete "${raffle.name}"?`
    if (raffle.ticketsSold > 0) {
      confirmMessage += `\n\nThis raffle has ${raffle.ticketsSold} sold tickets. Deletion will automatically process refunds.`
    }

    if (!window.confirm(confirmMessage)) return

    try {
      const raffleContract = getContractInstance(raffle.address, 'pool')
      if (!raffleContract) throw new Error('Failed to get raffle contract')

      const result = await executeTransaction(raffleContract.deleteRaffle)
      if (result.success) {
        toast.success(raffle.ticketsSold > 0
          ? `Raffle deleted! Refunds processed for ${raffle.ticketsSold} sold tickets.`
          : 'Raffle deleted successfully!')
        await Promise.all([fetchCreatedRaffles(), fetchPurchasedTickets()])
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete raffle')
    }
  }

  const handleViewRevenue = (raffle) => {
    setSelectedRaffle(raffle)
    setShowRevenueModal(true)
  }

  const handleClaimPrize = async (ticket) => {
    try {
      const poolContract = getContractInstance(ticket.raffleAddress, 'pool')
      if (!poolContract) throw new Error('Failed to get pool contract')

      const result = ticket.prizeAmount > 1
        ? await executeTransaction(poolContract.claimPrizes, ticket.prizeAmount)
        : await executeTransaction(poolContract.claimPrize)

      if (result.success) {
        toast.success('Prize claimed successfully!')
        await Promise.all([fetchCreatedRaffles(), fetchPurchasedTickets()])
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast.error(error.message || 'Failed to claim prize')
    }
  }

  const handleClaimRefund = async (ticket) => {
    try {
      const poolContract = getContractInstance(ticket.raffleAddress, 'pool')
      if (!poolContract) throw new Error('Failed to get pool contract')

      const result = await executeTransaction(poolContract.claimRefund)
      if (result.success) {
        toast.success('Refund claimed successfully!')
        await Promise.all([fetchCreatedRaffles(), fetchPurchasedTickets()])
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast.error(error.message || 'Failed to claim refund')
    }
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-4">
            <CircleDot className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground">
            Please connect your wallet to view your profile.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="container mx-auto px-4 md:px-8 pt-8">
        {/* Profile Header */}
        <ProfileHeader
          address={address}
          chainId={chainId}
          chainName={chainInfo?.name}
          className="mb-8"
        />

        {/* Stats Grid */}
        <StatCardGrid columns={4} className="mb-8">
          <AnimatedStatCard
            label="Slots Purchased"
            value={activityStats.totalSlotsPurchased || 0}
            icon={Ticket}
            gradient="from-blue-500 to-blue-600"
          />
          <AnimatedStatCard
            label="Raffles Created"
            value={activityStats.totalRafflesCreated || 0}
            icon={Plus}
            gradient="from-green-500 to-green-600"
          />
          <AnimatedStatCard
            label="Total Wins"
            value={activityStats.totalPrizesWon || 0}
            icon={Trophy}
            gradient="from-yellow-500 to-yellow-600"
          />
          <AnimatedStatCard
            label="Claimable Refunds"
            value={activityStats.totalClaimableRefunds
              ? (typeof activityStats.totalClaimableRefunds === 'string' && !activityStats.totalClaimableRefunds.startsWith('0x')
                  ? parseFloat(activityStats.totalClaimableRefunds).toFixed(4)
                  : parseFloat(ethers.utils.formatEther(activityStats.totalClaimableRefunds)).toFixed(4))
              : 0}
            suffix={getCurrencySymbol()}
            decimals={4}
            icon={DollarSign}
            gradient="from-orange-500 to-orange-600"
          />
        </StatCardGrid>

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-4 mb-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading on-chain data...</span>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full grid grid-cols-4 h-12 p-1 bg-muted/50 border border-border/50 rounded-xl">
            <TabsTrigger value="activity" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Activity</span>
            </TabsTrigger>
            <TabsTrigger value="created" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">My Raffles</span>
            </TabsTrigger>
            <TabsTrigger value="tickets" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
              <CircleDot className="h-4 w-4" />
              <span className="hidden sm:inline">Slots</span>
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
          </TabsList>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <Card variant="flat">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityTimeline
                  activities={transformedActivities}
                  onViewRaffle={handleNavigateToRaffle}
                  maxItems={10}
                  loading={loading}
                  emptyMessage="No activity yet. Create or join a raffle to get started!"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Created Raffles Tab */}
          <TabsContent value="created">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {createdRaffles.length === 0 ? (
                <Card variant="flat" className="col-span-full">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground mb-4">You haven't created any raffles yet.</p>
                    <Button variant="primary" onClick={() => navigate('/create-raffle-v2')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Raffle
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                createdRaffles.map((raffle) => (
                  <RaffleManagementCard
                    key={raffle.address}
                    raffle={raffle}
                    onDelete={handleDeleteRaffle}
                    onViewRevenue={handleViewRevenue}
                    onNavigate={handleNavigateToRaffle}
                  />
                ))
              )}
            </div>
          </TabsContent>

          {/* Purchased Slots Tab */}
          <TabsContent value="tickets">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {purchasedTickets.length === 0 ? (
                <Card variant="flat" className="col-span-full">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CircleDot className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground mb-4">You haven't purchased any raffle slots yet.</p>
                    <Button variant="primary" onClick={() => navigate('/app')}>
                      <ChevronRight className="h-4 w-4 mr-2" />
                      Browse Raffles
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                purchasedTickets.map((ticket, index) => (
                  <PurchasedSlotCard
                    key={`${ticket.raffleAddress}-${index}`}
                    ticket={ticket}
                    onClaimPrize={handleClaimPrize}
                    onClaimRefund={handleClaimRefund}
                    onNavigate={handleNavigateToRaffle}
                  />
                ))
              )}
            </div>
          </TabsContent>

          {/* Creator Dashboard Tab */}
          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Creator Stats */}
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>Creator Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Total Raffles</span>
                    <span className="font-semibold">{creatorStats.totalRaffles || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Active Raffles</span>
                    <span className="font-semibold">{creatorStats.activeRaffles || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Total Revenue</span>
                    <span className="font-semibold">
                      {creatorStats.totalRevenue
                        ? `${parseFloat(ethers.utils.formatEther(creatorStats.totalRevenue)).toFixed(4)} ${getCurrencySymbol()}`
                        : `0 ${getCurrencySymbol()}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Withdrawable</span>
                    <span className="font-semibold text-success">
                      {creatorStats.withdrawableRevenue
                        ? `${parseFloat(ethers.utils.formatEther(creatorStats.withdrawableRevenue)).toFixed(4)} ${getCurrencySymbol()}`
                        : `0 ${getCurrencySymbol()}`}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full justify-start gap-3"
                    onClick={() => navigate('/create-raffle-v2')}
                  >
                    <Plus className="h-5 w-5" />
                    Create New Raffle
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full justify-start gap-3"
                    onClick={() => navigate('/deploy-collection-v2')}
                  >
                    <Gift className="h-5 w-5" />
                    Deploy NFT Collection
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full justify-start gap-3"
                    onClick={() => navigate('/app')}
                  >
                    <ChevronRight className="h-5 w-5" />
                    Browse All Raffles
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Revenue Modal */}
        <Dialog open={showRevenueModal} onOpenChange={setShowRevenueModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Revenue Details</DialogTitle>
              <DialogDescription>
                View and manage revenue for this raffle.
              </DialogDescription>
            </DialogHeader>
            {selectedRaffle && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Raffle</span>
                    <span className="font-medium">{selectedRaffle.name}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Total Revenue</span>
                    <span className="font-medium">{ethers.utils.formatEther(selectedRaffle.totalRevenue)} {getCurrencySymbol()}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Tickets Sold</span>
                    <span className="font-medium">{selectedRaffle.ticketsSold}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowRevenueModal(false)}
                  >
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => {
                      // Handle revenue withdrawal
                      setShowRevenueModal(false)
                    }}
                  >
                    Withdraw
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

// Helper functions
function getActivityTitle(activity, getCurrencySymbol) {
  const raffleName = activity.raffleName || activity.name || `Raffle ${activity.raffleAddress?.slice(0, 8)}...`
  const quantity = activity.quantity || activity.ticketCount || 1

  switch (activity.type) {
    case 'ticket_purchase':
      return `Purchased ${quantity} ${raffleName} slot${quantity > 1 ? 's' : ''}`
    case 'raffle_created':
      return `Created raffle "${raffleName}"`
    case 'raffle_deleted':
      return `Deleted raffle "${raffleName}"`
    case 'prize_won':
      return `Won prize in "${raffleName}"`
    case 'prize_claimed':
      return `Claimed prize from "${raffleName}"`
    case 'refund_claimed':
      return `Claimed refund from "${raffleName}"`
    case 'revenue_withdrawn':
      return `Withdrew revenue from "${raffleName}"`
    case 'admin_withdrawn':
      return `Admin withdrawal: ${activity.amount} ${getCurrencySymbol()}`
    default:
      return activity.description || 'Activity'
  }
}

function getActivityDescription(activity, getCurrencySymbol) {
  switch (activity.type) {
    case 'ticket_purchase':
      return activity.amount ? `${activity.amount} ${getCurrencySymbol()}` : ''
    case 'refund_claimed':
      return activity.amount ? `${activity.amount} ${getCurrencySymbol()}` : ''
    default:
      return activity.description || ''
  }
}

export default ProfilePageV2
