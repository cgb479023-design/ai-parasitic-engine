/**
 * Aetheria-Flow Pillar 1: Formal Verification
 * 
 * The ContractManager ensures that data payloads strictly adhere to 
 * predefined logical propositions, moving beyond static type checks.
 * This is the FIRST line of defense against AI hallucinations.
 */

export interface ContractConstraint {
    id: string;
    validate: (payload: any) => boolean;
    errorMessage: string;
}

export interface Contract {
    id: string;
    constraints: ContractConstraint[];
}

class ContractManager {
    private static instance: ContractManager;
    private contracts: Map<string, Contract> = new Map();

    private constructor() {
        this.initDefaultContracts();
    }

    public static getInstance(): ContractManager {
        if (!ContractManager.instance) {
            ContractManager.instance = new ContractManager();
        }
        return ContractManager.instance;
    }

    private initDefaultContracts() {
        // Register dfl_metric_validity by default
        this.registerContract({
            id: 'dfl_metric_validity',
            constraints: [
                {
                    id: 'velocity_sanity',
                    validate: (data: any) => data.velocity >= 0 && data.velocity < 1000000,
                    errorMessage: 'Velocity data is outside of logical bounds (hallucination detected).'
                },
                {
                    id: 'rewatch_sanity',
                    validate: (data: any) => data.rewatchRatio >= 0 && data.rewatchRatio <= 5.0,
                    errorMessage: 'Rewatch ratio exceeds physical probability (scraping error suspected).'
                }
            ]
        });

        this.registerContract({
            id: 'burst_mode_safety',
            constraints: [
                {
                    id: 'minimum_algorithm_score',
                    validate: (data: any) => data.currentAlgorithmScore > 70,
                    errorMessage: 'Algorithm score too low for high-intensity burst mode.'
                },
                {
                    id: 'signal_density',
                    validate: (data: any) => data.activeSignals >= 1,
                    errorMessage: 'Insufficient viral signals to justify burst execution.'
                }
            ]
        });

        this.registerContract({
            id: 'youtube_metadata_validity',
            constraints: [
                {
                    id: 'title_length',
                    validate: (data: any) => data.title && data.title.length > 0 && data.title.length <= 100,
                    errorMessage: 'YouTube title must be between 1 and 100 characters.'
                },
                {
                    id: 'description_presence',
                    validate: (data: any) => !!data.description,
                    errorMessage: 'YouTube description cannot be empty.'
                }
            ]
        });

        this.registerContract({
            id: 'cross_platform_distribution',
            constraints: [
                {
                    id: 'x_content_validity',
                    validate: (data: any) => !data.x || (typeof data.x.text === 'string' && data.x.text.length > 0),
                    errorMessage: 'X post content must have non-empty text.'
                },
                {
                    id: 'tiktok_content_validity',
                    validate: (data: any) => !data.tiktok || (typeof data.tiktok.caption === 'string' && data.tiktok.caption.length > 0),
                    errorMessage: 'TikTok caption must be non-empty.'
                },
                {
                    id: 'youtube_id_presence',
                    validate: (data: any) => !data.youtubeVideoId || /^[a-zA-Z0-9_-]{10,12}$/.test(data.youtubeVideoId),
                    errorMessage: 'Invalid YouTube Video ID format.'
                }
            ]
        });
    }

    /**
     * Register a new contract with specific logical constraints
     */
    public registerContract(contract: Contract) {
        this.contracts.set(contract.id, contract);
        console.log(`[Aetheria-Flow] Contract Registered: ${contract.id}`);
    }

    /**
     * Verify a payload against a registered contract.
     * Throws an error if any constraint is violated.
     */
    public verify<T>(contractId: string, payload: T): T {
        const contract = this.contracts.get(contractId);

        if (!contract) {
            console.warn(`[Aetheria-Flow] WARNING: No contract found for ID: ${contractId}. Payload is UNVERIFIED.`);
            return payload;
        }

        for (const constraint of contract.constraints) {
            if (!constraint.validate(payload)) {
                const error = `🛑 [Constitutional Violation] ${contractId} -> ${constraint.id}: ${constraint.errorMessage}`;
                console.error(error, { payload });
                throw new Error(error);
            }
        }

        return payload;
    }
}

export const contractManager = ContractManager.getInstance();
