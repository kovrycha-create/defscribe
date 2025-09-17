export type StrandRelationType = 'ally' | 'friend' | 'acquaintance' | 'mortalEnemy';

export interface StrandRelationsData {
    [key: string]: {
        ally: string[];
        friend: string[];
        acquaintance: string[];
        mortalEnemy: string[];
        notes: string;
    }
}

// Data extracted from the Strands Relations Matrix in acu_canon.md
export const strandRelations: StrandRelationsData = {
    virtuo: {
        ally: ['lotur'],
        friend: ['vitaris'],
        acquaintance: ['nectiv'],
        mortalEnemy: ['voidrot'],
        notes: 'Order that breathes. Over‑tighten → drifts toward Ðethapart.'
    },
    optix: {
        ally: ['vitaris'],
        friend: ['cozmik'],
        acquaintance: ['memetic'],
        mortalEnemy: ['voidrot'],
        notes: 'Clarity engine; hostile to nihilistic decay.'
    },
    askanu: {
        ally: ['dreamin'],
        friend: ['nectiv'],
        acquaintance: ['elly'],
        mortalEnemy: ['dethapart'],
        notes: 'Care/compassion strand; risks enabling if unchecked.'
    },
    vitaris: {
        ally: ['virtuo'],
        friend: ['optix'],
        acquaintance: ['cozmik'],
        mortalEnemy: ['voidrot'],
        notes: 'Vitality & repair; burns hot under high gain.'
    },
    sanxxui: {
        ally: ['askanu'],
        friend: ['nectiv'],
        acquaintance: ['virtuo'],
        mortalEnemy: ['dethapart'],
        notes: 'Bonds & empathy; may enmesh if unchecked.'
    },
    lotur: {
        ally: ['virtuo'],
        friend: ['radi'],
        acquaintance: ['memetic'],
        mortalEnemy: ['dethapart'],
        notes: 'Held balance; pairs well with illumination.'
    },
    nectiv: {
        ally: ['askanu'],
        friend: ['memetic'],
        acquaintance: ['virtuo'],
        mortalEnemy: ['dethapart'],
        notes: 'Social glue; can calcify into conformity.'
    },
    memetic: {
        ally: ['cozmik'],
        friend: ['nectiv'],
        acquaintance: ['optix'],
        mortalEnemy: ['voidrot'],
        notes: 'Signal propagation; shadow: contagion.'
    },
    elly: {
        ally: ['vitaris'],
        friend: ['cozmik'],
        acquaintance: ['virtuo'],
        mortalEnemy: ['dethapart'],
        notes: 'Transformations, craft, kinetics; watch flux.'
    },
    cozmik: {
        ally: ['radi'],
        friend: ['optix'],
        acquaintance: ['vitaris'],
        mortalEnemy: ['voidrot'],
        notes: 'Expansion & play; needs witness to ground.'
    },
    radi: {
        ally: ['cozmik'],
        friend: ['askanu'],
        acquaintance: ['lotur'],
        mortalEnemy: ['dethapart'],
        notes: 'Revelation/illumination; can blind at high gain.'
    },
    dreamin: {
        ally: ['askanu'],
        friend: ['cozmik'],
        acquaintance: ['memetic'],
        mortalEnemy: ['dethapart'],
        notes: 'Intuition/dreaming; can unmoor without Virtuō.'
    },
    voidrot: {
        ally: [],
        friend: [],
        acquaintance: ['memetic'],
        mortalEnemy: ['virtuo'],
        notes: 'Necessary endings; lethal to ossified order.'
    },
    dethapart: {
        ally: [],
        friend: [],
        acquaintance: ['virtuo'],
        mortalEnemy: ['askanu'],
        notes: 'Disconnection/sterile partition; anti‑care bias.'
    }
};
