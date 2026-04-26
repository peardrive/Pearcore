/**
 * Here we store all the utilities that is being required
 * by CLI commands (seperate from utils/ directory)
 */
import { format } from 'date-fns'
import chalk from 'chalk'
import { shortenHashBy4 } from "../../utils/general.utils.js"

/**
 * Parse timestamp from various formats
 */
export function parseTimestamp(input) {
    if (!input) return null
    
    // If it's already a number
    if (!isNaN(input) && !isNaN(parseFloat(input))) {
        return parseInt(input)
    }
    
    // Try to parse as ISO date
    const date = new Date(input)
    return date.getTime()
}

/**
 * Display a message with human-readable formatting
 */
export function displayMessage(record, options = {}) {
    const { compact, raw, formatPayload = true } = options
    
    if (compact) {
        // Compact mode: single line summary
        const timestamp = format(new Date(record.broadcastTimestamp), 'HH:mm:ss')
        const senderShort = shortenHashBy4(record.senderPublicKey)
        console.log(
            chalk.gray(`[${timestamp}]`),
            chalk.cyan(senderShort),
            chalk.yellow(record.type),
            raw ? record.payload : shortenPayload(record.payload, 40)
        )
        return
    }

    // Verbose mode
    const fields = [
        { label: 'Type', value: record.type, color: chalk.yellow },
        { label: 'Nonce', value: record.nonce, color: chalk.gray },
        { label: 'From', value: shortenHashBy4(record.senderPublicKey), color: chalk.cyan },
        { label: 'Owner', value: shortenHashBy4(record.messageOwnerPublicKey), color: record.senderPublicKey === record.messageOwnerPublicKey ? chalk.green : chalk.magenta },
        { label: 'Relay', value: record.isRelay ? 'Yes' : 'No', color: record.isRelay ? chalk.magenta : chalk.green },
        { label: 'Broadcast', value: formatTimestamp(record.broadcastTimestamp), color: chalk.blue },
        { label: 'Created', value: formatTimestamp(record.messageTimestamp), color: chalk.blue },
        { label: 'Signature', value: shortenHashBy4(record.signature, 16), color: chalk.gray },
        { label: 'Topic', value: shortenHashBy4(record.topic, 24), color: chalk.gray }
    ]

    // Display fields
    for (const field of fields) {
        console.log(chalk.gray(field.label.padEnd(12)), field.color(field.value))
    }

    // Display payload
    console.log(chalk.gray('Payload'.padEnd(12)), chalk.white(formatPayloadDisplay(record.payload, { raw, formatPayload })))
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp) {
    const date = new Date(timestamp)
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()} (${timestamp})`
}

/**
 * Format payload for human-readable display
 */
export function formatPayloadDisplay(payload, options = {}) {
    const { raw, formatPayload } = options
    
    if (raw) {
        return payload
    }
    
    try {
        const parsed = JSON.parse(payload)
        
        if (!formatPayload) {
            return JSON.stringify(parsed)
        }
        
        // Handle different message types
        switch (typeof parsed) {
            case 'object':
                if (parsed.text) {
                    // Text message
                    return chalk.white(parsed.text)
                } else if (parsed.spaceName) {
                    // Space metadata
                    return `${chalk.yellow(parsed.spaceName)} ${chalk.gray(`by ${shortenHashBy4(parsed.publicKey)}`)}`
                } else if (parsed.url || parsed.hash) {
                    // Media message
                    return `📁 ${chalk.blue(parsed.filename || 'media')} ${chalk.gray(`(${parsed.size || 'unknown size'})`)}`
                } else {
                    // Generic object - show summary
                    const keys = Object.keys(parsed)
                    if (keys.length <= 3) {
                        return JSON.stringify(parsed, null, 2)
                    } else {
                        return `${chalk.gray(`{`)} ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? chalk.gray(`, +${keys.length - 3} more`) : ''} ${chalk.gray(`}`)}`
                    }
                }
            case 'string':
                return parsed
            default:
                return String(parsed)
        }
    } catch {
        // Not JSON, just return as-is
        return payload
    }
}