use std::time::Instant;

use port_scanner_lib::{
    scanner::{scan_with_options, CpuSampling},
    settings::default_settings,
};
use sysinfo::{Pid, ProcessesToUpdate, System};

fn main() {
    let settings = default_settings();
    compare_process_lookup();

    for (label, sampling) in [
        ("mesure CPU", CpuSampling::Measured),
        ("sans mesure CPU", CpuSampling::Skipped),
    ] {
        // Un tour à blanc pour ne pas mesurer le remplissage des caches système.
        let _ = scan_with_options(&settings, sampling);

        let started = Instant::now();
        let result = scan_with_options(&settings, sampling).expect("scan");
        println!(
            "{label}: {:?} pour {} ports",
            started.elapsed(),
            result.records.len()
        );
    }
}

/// Ce que coûte, avant d'arrêter un processus, le fait de recenser toute la
/// machine plutôt que le seul PID visé.
fn compare_process_lookup() {
    let target = Pid::from_u32(std::process::id());

    let started = Instant::now();
    let all = System::new_all();
    println!(
        "recensement complet : {:?} pour {} processus",
        started.elapsed(),
        all.processes().len()
    );

    let started = Instant::now();
    let mut system = System::new();
    system.refresh_processes(ProcessesToUpdate::Some(&[target]), true);
    println!(
        "processus visé seul : {:?} (trouvé : {})",
        started.elapsed(),
        system.process(target).is_some()
    );
}
