use clap::{Parser, Subcommand};

const SERIAL: &str = "HARDCODED-001";
const ADDRESS: &str = "0x1234567890abcdef1234567890abcdef12345678";

#[derive(Parser)]
#[command(name = "device")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Initialize device identity and print serial + address
    Init,
}

fn main() {
    let cli = Cli::parse();
    match cli.command {
        Command::Init => {
            println!("Serial: {SERIAL}");
            println!("Address: {ADDRESS}");
        }
    }
}

#[cfg(test)]
mod tests {
    use std::process::Command;

    fn device_bin() -> std::path::PathBuf {
        let mut path = std::env::current_exe().unwrap();
        // test binary is in target/debug/deps; the device binary is in target/debug
        path.pop();
        if path.ends_with("deps") {
            path.pop();
        }
        path.push("device");
        path
    }

    #[test]
    fn init_prints_serial_and_address() {
        let output = Command::new(device_bin())
            .args(["init"])
            .output()
            .expect("failed to run device binary");

        let stdout = String::from_utf8(output.stdout).unwrap();
        assert!(stdout.contains("Serial: HARDCODED-001"));
        assert!(stdout.contains("Address: 0x1234567890abcdef1234567890abcdef12345678"));
    }
}
