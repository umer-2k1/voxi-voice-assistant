/// Whisper expects 16 kHz mono f32. The capture stream runs at the device's
/// native rate/channels; this downmixes and linearly resamples in one pass.
/// Linear interpolation is adequate for speech into an STT model.
pub const TARGET_SAMPLE_RATE: u32 = 16_000;

pub fn to_whisper_input(samples: &[f32], sample_rate: u32, channels: u16) -> Vec<f32> {
    let mono: Vec<f32> = if channels <= 1 {
        samples.to_vec()
    } else {
        let ch = channels as usize;
        samples
            .chunks_exact(ch)
            .map(|frame| frame.iter().sum::<f32>() / ch as f32)
            .collect()
    };

    if sample_rate == TARGET_SAMPLE_RATE {
        return mono;
    }

    let ratio = sample_rate as f64 / TARGET_SAMPLE_RATE as f64;
    let out_len = (mono.len() as f64 / ratio).floor() as usize;
    (0..out_len)
        .map(|i| {
            let pos = i as f64 * ratio;
            let idx = pos as usize;
            let frac = (pos - idx as f64) as f32;
            let a = mono[idx];
            let b = *mono.get(idx + 1).unwrap_or(&a);
            a + (b - a) * frac
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn downmixes_stereo_to_mono() {
        let stereo = [1.0, 0.0, 0.5, 0.5];
        let mono = to_whisper_input(&stereo, TARGET_SAMPLE_RATE, 2);
        assert_eq!(mono, vec![0.5, 0.5]);
    }

    #[test]
    fn resamples_48k_to_16k_at_third_length() {
        let input = vec![0.0f32; 48_000];
        let out = to_whisper_input(&input, 48_000, 1);
        assert_eq!(out.len(), 16_000);
    }
}
