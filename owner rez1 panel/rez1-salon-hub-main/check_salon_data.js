import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkSalon() {
    const { data: salon, error } = await supabase
        .from('salons')
        .select('*')
        .limit(1)
        .single();
    
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Salon Data:', JSON.stringify(salon, null, 2));
    }
}

checkSalon();
