import { ethers } from 'ethers'
import { contractABIs } from '../contracts/contractABIs'

const ERROR_STRING_SELECTOR = '0x08c379a0'
const PANIC_SELECTOR = '0x4e487b71'

const panicCodes = {
  0x01: 'Assertion failed',
  0x11: 'Arithmetic overflow/underflow',
  0x12: 'Division or modulo by zero',
  0x21: 'Invalid enum value',
  0x22: 'Storage byte array that is incorrectly encoded',
  0x31: 'Calling `.pop()` on an empty array',
  0x32: 'Array index out of bounds',
  0x41: 'Out-of-memory',
  0x51: 'Invalid contract creation code'
}

const interfaces = (() => {
  const ifaces = []
  try {
    for (const [name, abi] of Object.entries(contractABIs)) {
      if (Array.isArray(abi)) {
        ifaces.push({ name, iface: new ethers.utils.Interface(abi) })
      } else if (abi && Array.isArray(abi.abi)) {
        ifaces.push({ name, iface: new ethers.utils.Interface(abi.abi) })
      }
    }
  } catch (e) {
    console.warn('ErrorDecoder: failed to init interfaces', e)
  }
  return ifaces
})()

const tryDecodeErrorString = (data) => {
  if (!data || typeof data !== 'string') return null
  if (!data.startsWith(ERROR_STRING_SELECTOR)) return null
  try {
    const reason = ethers.utils.defaultAbiCoder.decode(['string'], '0x' + data.slice(10))
    return { type: 'Error(string)', message: reason[0] }
  } catch {
    return null
  }
}

const tryDecodePanic = (data) => {
  if (!data || typeof data !== 'string') return null
  if (!data.startsWith(PANIC_SELECTOR)) return null
  try {
    const code = ethers.utils.defaultAbiCoder.decode(['uint256'], '0x' + data.slice(10))[0].toNumber()
    const desc = panicCodes[code] || `Panic code 0x${code.toString(16)}`
    return { type: 'Panic(uint256)', message: desc, panicCode: code }
  } catch {
    return null
  }
}

const tryParseCustomError = (data) => {
  if (!data || typeof data !== 'string') return null
  for (const { name, iface } of interfaces) {
    try {
      const parsed = iface.parseError(data)
      if (parsed) {
        return {
          type: 'CustomError',
          sourceContract: name,
          errorName: parsed.name,
          signature: parsed.signature,
          args: parsed.args ? Array.from(parsed.args) : []
        }
      }
    } catch {}
  }
  return null
}

export const decodeRevertData = (data) => {
  return (
    tryDecodeErrorString(data) ||
    tryDecodePanic(data) ||
    tryParseCustomError(data)
  )
}

export const buildFriendlyMessage = (decoded, fallback) => {
  if (!decoded) return fallback || 'Transaction failed'
  if (decoded.type === 'Error(string)') return decoded.message || fallback || 'Transaction failed'
  if (decoded.type === 'Panic(uint256)') return decoded.message || fallback || 'Transaction failed'
  if (decoded.type === 'CustomError') {
    const name = decoded.errorName
    const map = {
      // Pool.sol
      ContractsCannotPurchase: 'Contract accounts cannot purchase slots',
      IncorrectPayment: 'Incorrect payment amount sent',
      ExceedsSlotLimit: 'You cannot exceed the per-participant slot limit',
      NotAWinner: 'You are not a winner for this pool',
      NoPrizesToClaim: 'No prizes available to claim',
      InvalidPoolState: 'Action not allowed in the current pool state',
      OnlyOperator: 'You are not authorized to perform this action',
      SocialEngagementNotConfigured: 'Social engagement requirement is not configured',
      PoolDurationElapsed: 'Pool has already ended',
      ZeroSlotFee: 'Slot fee must be greater than zero',
      PrizeTransferFailed: 'Prize transfer failed',
      MintingNotSupported: 'Collection does not support minting for this action',
      // ERC721/1155 Prize
      UnauthorizedMinter: 'You are not authorized as minter for this collection',
      ZeroQuantity: 'Quantity must be greater than zero',
      SupplyNotSet: 'Supply is not set for this token',
      ExceedsMaxSupply: 'This action would exceed the collection\'s max supply'
    }
    return map[name] || name
  }
  return fallback || 'Transaction failed'
}

export const extractReasonFromMessage = (error) => {
  if (!error) return null
  const m = (error.reason || error.message || '').toString()
  const match = m.match(/reason="([^"]+)"/)
  if (match) return match[1]
  return null
}

export const decodeError = (error) => {
  // best-effort gather revert data
  const data = error?.data?.data || error?.error?.data || error?.data || error?.receipt?.revertReason
  const decoded = decodeRevertData(typeof data === 'string' ? data : null)
  const reasonMsg = extractReasonFromMessage(error)
  const fallback = reasonMsg || (error?.reason || error?.message || 'Transaction failed')
  const friendly = buildFriendlyMessage(decoded, fallback)
  return { decoded, message: friendly }
}
