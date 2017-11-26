# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|

  config.vm.hostname = "pm2service"
  config.vm.box = ENV.fetch("BASEBOX", "centos")

  config.vm.provision "shell", inline: <<-SHELL
    yum install -y ansible nodejs npm
    mkdir -p /vagrant /home/vagrant/.ansible/roles
    ln -sf /vagrant /home/vagrant/.ansible/roles/pm2service
    mkdir -p /usr/share/ansible/roles
    npm install --global pm2
  SHELL
end
