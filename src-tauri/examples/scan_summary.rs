use std::collections::HashSet;

use port_scanner_lib::{scanner::scan_with_settings, settings::default_settings};

fn main() {
    let result = scan_with_settings(&default_settings()).expect("live socket scan failed");
    let processes: HashSet<u32> = result
        .records
        .iter()
        .filter_map(|record| record.pid)
        .collect();
    let protected = result
        .records
        .iter()
        .filter(|record| record.protected)
        .count();
    let exposed = result
        .records
        .iter()
        .filter(|record| record.scope == "network")
        .count();

    println!("platform={}", result.platform);
    println!("ports={}", result.records.len());
    println!("processes={}", processes.len());
    println!("exposed={exposed}");
    println!("protected={protected}");
    println!("permission_limited={}", result.permission_limited);
}
